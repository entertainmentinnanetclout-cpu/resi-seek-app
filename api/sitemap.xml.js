import sitemapHandler from "./sitemap.js";

export default function handler(req, res) {
  req.query = {};
  return sitemapHandler(req, res);
}
