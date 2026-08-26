import sitemapHandler from "../sitemap.js";
export default function handler(req, res) { req.query = { type: "residences" }; return sitemapHandler(req, res); }
