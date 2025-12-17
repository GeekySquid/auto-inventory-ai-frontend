const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'super_secret_key_change_in_prod';
const MONGO_URI = 'mongodb://localhost:27017/hanuman_traders';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas & Models ---

const RoleSchema = new mongoose.Schema({
    id: String,
    name: String,
    permissions: [String],
    is_system: Boolean
});
const Role = mongoose.model('Role', RoleSchema);

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    tenant_id: String,
    managed_location_ids: [String],
    permissions: [String]
});
const User = mongoose.model('User', UserSchema);

const LocationSchema = new mongoose.Schema({
    id: String,
    name: String,
    tenant_id: String,
    type: String,
    address: String
});
const Location = mongoose.model('Location', LocationSchema);

const ProductSchema = new mongoose.Schema({
    id: String,
    name: String,
    sku: String,
    category: String,
    price: Number,
    cost: Number,
    stock: { type: Map, of: Number }, // Map of locationId -> quantity
    tenant_id: String,
    minStockLevel: { type: Number, default: 10 }
});
const Product = mongoose.model('Product', ProductSchema);

const CustomerSchema = new mongoose.Schema({
    id: String,
    name: String,
    phone: String,
    email: String,
    gstNumber: String,
    address: String,
    loyaltyPoints: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 }
});
const Customer = mongoose.model('Customer', CustomerSchema);

const SupplierSchema = new mongoose.Schema({
    id: String,
    name: String,
    contactPerson: String,
    phone: String,
    email: String,
    address: String,
    category: String,
    rating: Number,
    paymentTerms: String,
    lastSupplyDate: String
});
const Supplier = mongoose.model('Supplier', SupplierSchema);

const SaleSchema = new mongoose.Schema({
    id: String,
    date: String,
    items: [], // Array of objects
    totalAmount: Number,
    totalTax: Number,
    subtotal: Number,
    customerId: String,
    customerName: String,
    locationId: String,
    paymentMethod: String,
    transactionId: String
});
const Sale = mongoose.model('Sale', SaleSchema);

const TransferSchema = new mongoose.Schema({
    id: String,
    productId: String,
    fromLocationId: String,
    toLocationId: String,
    quantity: Number,
    date: String,
    timestamp: Number,
    status: String,
    reason: String,
    notes: String
});
const Transfer = mongoose.model('Transfer', TransferSchema);

const TaxTierSchema = new mongoose.Schema({
    id: String,
    name: String,
    categoryType: String,
    rate: Number,
    cgst: Number,
    sgst: Number
});
const TaxTier = mongoose.model('TaxTier', TaxTierSchema);

// --- Auth Routes ---

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: user.role, tenantId: user.tenant_id }, SECRET_KEY, { expiresIn: '1h' });

        // User object cleaning
        const userData = user.toObject();
        delete userData.password;
        // Frontend expects 'managedLocationIds' but DB has snake_case in SQLite. 
        // In Mongo, we defined 'managed_location_ids' in schema.
        // Let's normalize response for frontend:
        userData.managedLocationIds = userData.managed_location_ids;

        res.json({ token, user: userData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Middleware ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Data Routes ---

app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'WAREHOUSE_OWNER' || req.user.role === 'WAREHOUSE_MANAGER') {
            query.tenant_id = req.user.tenantId;
        }

        const products = await Product.find(query);
        res.json(products);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Product.findOneAndUpdate({ id }, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Product not found' });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await Product.deleteOne({ id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/locations', authenticateToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'WAREHOUSE_OWNER') {
            query.tenant_id = req.user.tenantId;
        }
        const locs = await Location.find(query);
        res.json(locs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/customers', authenticateToken, async (req, res) => {
    try {
        const customers = await Customer.find({});
        res.json(customers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
    try {
        const newCust = new Customer(req.body);
        await newCust.save();
        res.status(201).json(newCust);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const suppliers = await Supplier.find({});
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sales', authenticateToken, async (req, res) => {
    try {
        // Filter by tenant/location if needed, for now return all allowed
        // In real app, filter by location permission
        const sales = await Sale.find({});
        res.json(sales);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sales', authenticateToken, async (req, res) => {
    try {
        const newSale = new Sale(req.body);
        await newSale.save();
        res.status(201).json(newSale);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/transfers', authenticateToken, async (req, res) => {
    try {
        const transfers = await Transfer.find({});
        res.json(transfers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/transfers', authenticateToken, async (req, res) => {
    try {
        const newTransfer = new Transfer(req.body);
        await newTransfer.save();
        res.status(201).json(newTransfer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tax-tiers', authenticateToken, async (req, res) => {
    try {
        const tiers = await TaxTier.find({});
        res.json(tiers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- External Services Routes ---

app.get('/api/market-price', authenticateToken, async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Product name required' });

        // scrape logic
        const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
        const query = `${cleanName} price per kg india online grocery`;
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        console.log(`[MarketPrice] Searching for: ${cleanName} | URL: ${url}`);

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        // Parse snippets
        $('.result__snippet').each((i, el) => {
            const text = $(el).text();
            // Regex to find prices like ₹ 50, Rs. 50, Rs 50, INR 50
            // Captures: 1=Currency, 2=Amount
            const priceMatch = text.match(/(?:₹|Rs\.?|INR)\s?(\d+(?:,\d+)*(?:\.\d{1,2})?)/i);
            if (priceMatch && priceMatch[1]) {
                const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                if (price > 10 && price < 10000) { // Sanity check
                    results.push(price);
                }
            }
        });

        // Heuristic: Median or Average of first 3 valid results to avoid outliers
        // For MVP, just take the first valid one or average
        if (results.length > 0) {
            const valid = results.slice(0, 5);
            const sum = valid.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / valid.length);
            return res.json({ marketPrice: avg, source: 'Aggregated Online Sources' });
        }

        res.json({ marketPrice: null });

    } catch (e) {
        console.error("Market price fetch failed:", e.message);
        res.status(500).json({ error: "Failed to fetch market price" });
    }
});

// --- User Management Routes ---

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'WAREHOUSE_OWNER') {
            query.tenant_id = req.user.tenantId;
        } else if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const users = await User.find(query);
        const parsedUsers = users.map(u => {
            const obj = u.toObject();
            obj.managedLocationIds = obj.managed_location_ids; // normalize
            return obj;
        });
        res.json(parsedUsers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { name, email, password, role, locationId, permissions } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = `u-${Date.now()}`;

        let tenantId = null;
        if (req.user.role === 'WAREHOUSE_OWNER') {
            tenantId = req.user.tenantId;
        } else if (req.user.role === 'SUPER_ADMIN' && req.body.tenantId) {
            tenantId = req.body.tenantId;
        }

        const newUser = new User({
            id: userId,
            name,
            email,
            password: passwordHash,
            role,
            tenant_id: tenantId,
            managed_location_ids: locationId ? [locationId] : [],
            permissions: permissions || []
        });

        await newUser.save();

        const responseUser = newUser.toObject();
        delete responseUser.password;
        responseUser.managedLocationIds = responseUser.managed_location_ids;

        res.status(201).json(responseUser);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, locationId, permissions } = req.body;

        const user = await User.findOne({ id });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (req.user.role !== 'SUPER_ADMIN' && user.tenant_id !== req.user.tenantId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        user.name = name;
        user.email = email;
        user.role = role;
        user.permissions = permissions || [];
        if (locationId) user.managed_location_ids = [locationId];

        await user.save();
        res.json({ success: true, message: 'User updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete self' });

        const user = await User.findOne({ id });
        if (!user) return res.status(404).json({ error: 'Not found' });

        if (req.user.role !== 'SUPER_ADMIN' && user.tenant_id !== req.user.tenantId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await User.deleteOne({ id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Role Management Routes ---

app.get('/api/roles', authenticateToken, async (req, res) => {
    try {
        const roles = await Role.find({});
        const parsedRoles = roles.map(r => {
            const obj = r.toObject();
            obj.isSystem = obj.is_system; // normalize
            return obj;
        });
        res.json(parsedRoles);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/roles', authenticateToken, async (req, res) => {
    try {
        const { name, permissions } = req.body;
        if (!name) return res.status(400).json({ error: 'Role name required' });

        const roleId = `role-${Date.now()}`;
        const newRole = new Role({
            id: roleId,
            name,
            permissions: permissions || [],
            is_system: false
        });

        await newRole.save();
        res.status(201).json({ id: roleId, name, permissions: newRole.permissions, isSystem: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/roles/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions } = req.body;

        const role = await Role.findOne({ id });
        if (!role) return res.status(404).json({ error: 'Role not found' });

        if (role.is_system && name !== role.name) {
            return res.status(400).json({ error: 'Cannot rename system role' });
        }

        role.name = name;
        role.permissions = permissions || [];
        await role.save();

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/roles/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const role = await Role.findOne({ id });
        if (!role) return res.status(404).json({ error: 'Role not found' });

        if (role.is_system) return res.status(403).json({ error: 'Cannot delete system role' });

        await Role.deleteOne({ id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/market-price-v2', authenticateToken, async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'Product name required' });

        const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
        const query = `${cleanName} price per kg india online grocery`;
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        console.log(`[MarketPriceV2] Searching for: ${cleanName} | URL: ${url}`);

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.result__snippet, .result__body').each((i, el) => {
            const text = $(el).text();
            const priceMatch = text.match(/(?:₹|Rs\.?|INR)\s?(\d+(?:,\d+)*(?:\.\d{1,2})?)/i);
            if (priceMatch && priceMatch[1]) {
                const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                if (price > 10 && price < 10000) {
                    results.push(price);
                    console.log(`[MarketPriceV2] Found: ${price} in text snippet`);
                }
            }
        });

        if (results.length > 0) {
            results.sort((a, b) => a - b);
            const mid = Math.floor(results.length / 2);
            const median = results.length % 2 !== 0 ? results[mid] : (results[mid - 1] + results[mid]) / 2;
            console.log(`[MarketPriceV2] Result: ${median}`);
            return res.json({ marketPrice: median });
        }

        console.log(`[MarketPriceV2] No valid prices found`);
        res.json({ marketPrice: null });

    } catch (e) {
        console.error("Market price v2 fetch failed:", e.message);
        res.status(500).json({ error: "Failed to fetch market price" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
