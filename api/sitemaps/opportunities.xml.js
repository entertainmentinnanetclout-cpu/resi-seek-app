import sitemapHandler from "../sitemap.js";
export default function handler(req, res) { req.query = { type: "opportunities" }; return sitemapHandler(req, res); }
