
import { Product, Sale, Transfer, Supplier } from '../types';

// ==========================================
// Types & Interfaces
// ==========================================

export interface StrategicInsight {
    id: string;
    type: 'Profit Optimization' | 'Risk Mitigation' | 'Cash Flow' | 'Growth';
    problem: string;
    impact: string;
    recommendedAction: string;
    roiImpact: string;
    confidenceScore: number;
    actionType: 'TRANSFER' | 'LIQUIDATE' | 'REORDER' | 'PRICE_ADJUST';
    metadata?: any;
}

export interface StockHealth {
    status: 'Overstock' | 'Stockout Risk' | 'Healthy' | 'Dead Stock';
    coverDays: number;
    agingScore: number;
}

// ==========================================
// 1. Data Intelligence Preparation
// ==========================================

/**
 * Calculates Demand Velocity: Avg Quantity Sold per Day over N days
 */
export const calculateDemandVelocity = (
    productId: string,
    sales: Sale[],
    days: number = 30
): number => {
    if (!sales || sales.length === 0) return 0;

    const now = new Date();
    const pastDate = new Date();
    pastDate.setDate(now.getDate() - days);

    const relevantSales = sales.filter(s => {
        const saleDate = new Date(s.date);
        return saleDate >= pastDate && saleDate <= now;
    });

    const totalQty = relevantSales.reduce((acc, sale) => {
        const item = sale.items.find(i => i.id === productId);
        return acc + (item ? item.quantity : 0);
    }, 0);

    return totalQty / days;
};

/**
 * Calculates Inventory Cover Days = Current Stock / Demand Velocity
 */
export const calculateInventoryCover = (
    stockQuantity: number,
    velocity: number
): number => {
    if (velocity <= 0) return stockQuantity > 0 ? 999 : 0; // Infinite cover if no sales but has stock
    return stockQuantity / velocity;
};

/**
 * Calculates Stock Aging Score based on last movement
 */
export const calculateAgingScore = (
    lastMovementDate: string | undefined,
    coverDays: number
): number => {
    if (!lastMovementDate) return 0;

    const daysSinceMovement = (new Date().getTime() - new Date(lastMovementDate).getTime()) / (1000 * 3600 * 24);
    const safeCoverDays = coverDays === 0 ? 1 : coverDays;

    return daysSinceMovement / safeCoverDays;
};

// ==========================================
// 2. Core Analytical Algorithms
// ==========================================

/**
 * Classifies Stock Health: Overstock, Stockout Risk, Healthy
 */
export const analyzeStockHealth = (
    coverDays: number,
    optimalCover: number = 30,
    safetyStockDays: number = 7
): 'Overstock' | 'Stockout Risk' | 'Healthy' => {
    if (coverDays > 2 * optimalCover) return 'Overstock';
    if (coverDays < safetyStockDays) return 'Stockout Risk';
    return 'Healthy';
};

/**
 * Detects Dead Stock based on days since last sale
 */
export const detectDeadStock = (
    product: Product,
    sales: Sale[],
    thresholdDays: number = 90
): boolean => {
    const lastSale = sales
        .flatMap(s => s.items)
        .filter(i => i.id === product.id)
    // Assuming sales are roughly ordered, but technically we should sort. 
    // For MVP, checking if ANY sale exists in last thresholdDays is sufficient.

    // Better approach: Find most recent sale date
    let lastSaleDate = new Date(0); // Epoch
    sales.forEach(s => {
        const hasItem = s.items.some(i => i.id === product.id);
        if (hasItem) {
            const d = new Date(s.date);
            if (d > lastSaleDate) lastSaleDate = d;
        }
    });

    const daysSinceLastSale = (new Date().getTime() - lastSaleDate.getTime()) / (1000 * 3600 * 24);

    // Also check if we actually have stock. No dead stock if no stock.
    const totalStock = Object.values(product.stock).reduce((a, b) => a + b, 0);

    return totalStock > 0 && daysSinceLastSale > thresholdDays;
};

// ==========================================
// 3. Multi-Warehouse Transfer Optimization
// ==========================================

export const findTransferOpportunities = (
    products: Product[],
    sales: Sale[]
): StrategicInsight[] => {
    const insights: StrategicInsight[] = [];

    // Warehouse Identifiers (simplified for MVP)
    const warehouseIds = ['warehouse-a', 'store-downtown', 'north-branch', 'city-center-store'];

    products.forEach(p => {
        // 1. Map stock and velocity per location
        const locStats = warehouseIds.map(locId => {
            const stock = p.stock[locId] || 0;
            // Filter sales by location to get local velocity
            const localSales = sales.filter(s => s.locationId === locId);
            const velocity = calculateDemandVelocity(p.id, localSales);
            const cover = calculateInventoryCover(stock, velocity);

            return { locId, stock, velocity, cover };
        });

        // 2. Identify Overstock and Stockout locations
        const overstocked = locStats.filter(l => l.cover > 60); // > 60 days
        const starving = locStats.filter(l => l.cover < 10 && l.velocity > 0.1); // < 10 days & sells at least 1/10 days (approx 3/mo)

        // 3. Match
        overstocked.forEach(source => {
            starving.forEach(target => {
                if (source.stock > 10) { // Only transfer if we have meaningful excess
                    const transferQty = Math.floor(Math.min(source.stock * 0.5, (30 - target.cover) * target.velocity));

                    if (transferQty > 0) {
                        const cost = p.cost || 0;
                        const price = p.price || 0;
                        const margin = price - cost;
                        const estimatedGain = margin * transferQty;
                        const transferCost = 50 + (transferQty * 2); // Base + unit cost placeholder

                        if (estimatedGain > transferCost) {
                            insights.push({
                                id: `transfer-${p.id}-${source.locId}-${target.locId}`,
                                type: 'Profit Optimization',
                                problem: `Stock imbalance for ${p.name}`,
                                impact: `Potential missed sales in ${target.locId}`,
                                recommendedAction: `Transfer ${transferQty} units from ${source.locId} to ${target.locId}`,
                                roiImpact: `+₹${Math.floor(estimatedGain - transferCost)}`,
                                confidenceScore: 0.9,
                                actionType: 'TRANSFER',
                                metadata: { productId: p.id, from: source.locId, to: target.locId, qty: transferQty }
                            });
                        }
                    }
                }
            });
        });
    });

    return insights;
};

// ==========================================
// 4. Main Insight Generator
// ==========================================

export const generateStrategicInsights = (
    products: Product[],
    sales: Sale[],
    // transfers: Transfer[], // Future use
    // suppliers: Supplier[]  // Future use
): StrategicInsight[] => {
    const insights: StrategicInsight[] = [];

    // A. Transfer Optimization
    const transferInsights = findTransferOpportunities(products, sales);
    insights.push(...transferInsights);

    // B. Dead Stock Liquidation
    products.forEach(p => {
        if (detectDeadStock(p, sales)) {
            const totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
            const capitalBlocked = totalStock * (p.cost || 0);

            if (capitalBlocked > 1000) { // Only flag meaningful amounts
                insights.push({
                    id: `deadstock-${p.id}`,
                    type: 'Cash Flow',
                    problem: `Dead Stock: ${p.name}`,
                    impact: `₹${capitalBlocked.toLocaleString()} capital blocked`,
                    recommendedAction: `Liquidate ${totalStock} units. Run clearance sale.`,
                    roiImpact: `Recover ~₹${(capitalBlocked * 0.7).toLocaleString()}`, // Assume 30% markdown loss better than 100%
                    confidenceScore: 0.85,
                    actionType: 'LIQUIDATE',
                    metadata: { productId: p.id, currentStock: totalStock }
                });
            }
        }
    });

    // C. Reorder Risk (Stockout Prediction)
    products.forEach(p => {
        const overallDistVelocity = calculateDemandVelocity(p.id, sales);
        const totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
        const overallCover = calculateInventoryCover(totalStock, overallDistVelocity);

        if (overallCover < 14 && overallDistVelocity > 0.5) { // < 2 weeks cover
            const reorderQty = Math.ceil(overallDistVelocity * 30);
            insights.push({
                id: `reorder-${p.id}`,
                type: 'Risk Mitigation',
                problem: `Stockout Risk: ${p.name}`,
                impact: `Only ${Math.floor(overallCover)} days of stock left`,
                recommendedAction: `Place urgent reorder for ${reorderQty} units`,
                roiImpact: `Protect ~₹${(overallDistVelocity * 14 * (p.price - p.cost)).toLocaleString()} profit`,
                confidenceScore: 0.95,
                actionType: 'REORDER',
                metadata: { productId: p.id, reorderQty }
            });
        }
    });

    // Sort by Estimated ROI Value (parsed from string or simplified heuristic)
    // For now, heuristic: Risk > Profit > Cash Flow
    const priorityMap = { 'Risk Mitigation': 3, 'Profit Optimization': 2, 'Cash Flow': 1, 'Growth': 0 };

    return insights.sort((a, b) => priorityMap[b.type] - priorityMap[a.type]).slice(0, 5); // Return top 5
};

// ==========================================
// 5. Forecasting & Growth Engine
// ==========================================

export interface ProductForecast {
    productId: string;
    name: string;
    currentMonthlySales: number; // Volume
    previousMonthlySales: number; // Volume
    growthRate: number; // Percentage
    trend: 'High Growth' | 'Stable' | 'Declining' | 'New';
    forecastedSales: number; // Next 30 days volume
    confidence: number;
    history: { date: string; value: number }[]; // For graph
}

export const generateProductForecasts = (products: Product[], sales: Sale[]): ProductForecast[] => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    return products.map(p => {
        // 1. Filter Sales for this product
        const productSales = sales.filter(s => s.items.some(i => i.id === p.id));

        // 2. Split into periods
        let currentQty = 0;
        let previousQty = 0;
        const dailyHistory: Record<string, number> = {};

        productSales.forEach(s => {
            const saleDate = new Date(s.date);
            const item = s.items.find(i => i.id === p.id);
            if (!item) return;

            // Populate History (last 60 days)
            if (saleDate >= sixtyDaysAgo) {
                const dateStr = saleDate.toISOString().split('T')[0];
                dailyHistory[dateStr] = (dailyHistory[dateStr] || 0) + item.quantity;
            }

            if (saleDate >= thirtyDaysAgo) {
                currentQty += item.quantity;
            } else if (saleDate >= sixtyDaysAgo) {
                previousQty += item.quantity;
            }
        });

        // 3. Calculate Growth
        let growthRate = 0;
        if (previousQty > 0) {
            growthRate = ((currentQty - previousQty) / previousQty) * 100;
        } else if (currentQty > 0) {
            growthRate = 100; // New or exploded
        }

        // 4. Determine Trend
        let trend: ProductForecast['trend'] = 'Stable';
        if (previousQty === 0 && currentQty > 0) trend = 'New';
        else if (growthRate >= 20) trend = 'High Growth';
        else if (growthRate <= -20) trend = 'Declining';

        // 5. Forecast (Simple Moving Average + Trend Momentum)
        // If high growth, assume 50% of growth momentum continues.
        // If declining, assume 50% deceleration continues.
        const baseForecast = currentQty;
        const momentumFactor = trend === 'High Growth' ? 1.2 : trend === 'Declining' ? 0.9 : 1.0;
        const forecastedSales = Math.ceil(baseForecast * momentumFactor);

        // 6. Format History for Graph
        const historyArray = Object.entries(dailyHistory)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            productId: p.id,
            name: p.name,
            currentMonthlySales: currentQty,
            previousMonthlySales: previousQty,
            growthRate,
            trend,
            forecastedSales,
            confidence: 0.85, // Placeholder for statistical significance calculation
            history: historyArray
        };
    }).sort((a, b) => b.forecastedSales - a.forecastedSales); // Sort by volume importance
};
