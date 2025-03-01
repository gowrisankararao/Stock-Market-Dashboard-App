const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI("AIzaSyBVlNL5e4VGk-sAT7TE948vOeSuIglh-3I");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Function to fetch stock data (Mock API for demonstration)
async function getTopStocks() {
    try {
        const response = await axios.get("https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=" + process.env.FMP_API_KEY);
        return response.data.slice(0, 15);  // Get top 15 stocks
    } catch (error) {
        console.error("Error fetching stock data:", error);
        return [];
    }
}

// Function to generate AI insights
async function getStockInsights(stockSymbol) {
    try {
        const prompt = `Give a brief analysis of stock ${stockSymbol} for a new investor.`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "No insights available.";
    }
}

// Controller to render stock.ejs with stocks & AI insights
exports.getStocks = async (req, res) => {
    const stocks = await getTopStocks();
    const insights = await Promise.all(stocks.map(stock => getStockInsights(stock.symbol)));  

    res.render("stock", { stocks, insights });
};
