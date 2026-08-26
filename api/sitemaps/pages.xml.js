import sitemapHandler from "../sitemap.js";
export default function handler(req, res) { req.query = { type: "pages" }; return sitemapHandler(req, res); }
