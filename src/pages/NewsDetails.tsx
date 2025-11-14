import { useParams } from "react-router-dom";
import { Copy } from "lucide-react";
import { useState } from "react";
import { newsArticles } from "src/data/news"; // adjust path if needed

const NewsDetails = () => {
  const { id } = useParams();
  const article = newsArticles.find(a => a.id.toString() === id);
  const [copied, setCopied] = useState(false);

  if (!article) return <p className="p-6 text-center">Article not found</p>;

  const shareUrl = `https://reskonnect.co.za/news/${article.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <img src={article.image} alt={article.title} className="w-full rounded-lg mb-6" />

      <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
      <p className="text-muted-foreground mb-6">
        {article.author} • {new Date(article.date).toLocaleDateString()}
      </p>

      <p className="text-lg mb-8 whitespace-pre-line">{article.fullDescription || article.description}</p>

      <h2 className="text-xl font-semibold mb-4">Share this post</h2>

      <div className="flex gap-4 flex-wrap">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(article.title + " " + shareUrl)}`}
          target="_blank"
          className="px-4 py-2 bg-green-500 text-white rounded-md"
        >
          WhatsApp
        </a>

        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          className="px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Facebook
        </a>

        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title)}`}
          target="_blank"
          className="px-4 py-2 bg-black text-white rounded-md"
        >
          Share on X
        </a>

        <button
          onClick={copyLink}
          className="px-4 py-2 bg-gray-700 text-white rounded-md flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
};

export default NewsDetails;
