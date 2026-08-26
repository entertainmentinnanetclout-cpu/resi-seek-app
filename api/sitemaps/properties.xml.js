import sitemapHandler from "../sitemap.js";
export default function handler(req, res) { req.query = { type: "properties" }; return sitemapHandler(req, res); }
