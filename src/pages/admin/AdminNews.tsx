import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface CampusNews {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  category: string;
  author: string | null;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
}

const emptyNews: Partial<CampusNews> = {
  title: "",
  content: "",
  excerpt: "",
  image_url: "",
  category: "general",
  author: "",
  is_published: false,
};

const categories = ["general", "academic", "sports", "events", "announcements", "student-life"];

const AdminNews = () => {
  const [news, setNews] = useState<CampusNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<Partial<CampusNews> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("campus_news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching news:", error);
      toast.error("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    
    // Realtime subscription for live updates
    const channel = supabase
      .channel('admin-news-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_news' }, () => {
        fetchNews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSave = async () => {
    if (!editingNews?.title || !editingNews?.content) {
      toast.error("Title and content are required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingNews.image_url;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `news-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("admin-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("admin-images")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const newsData = {
        title: editingNews.title,
        content: editingNews.content,
        excerpt: editingNews.excerpt || null,
        image_url: imageUrl || null,
        category: editingNews.category || "general",
        author: editingNews.author || null,
        is_published: editingNews.is_published ?? false,
        published_at: editingNews.is_published ? new Date().toISOString() : null,
      };

      if (editingNews.id) {
        const { error } = await supabase.from("campus_news").update(newsData).eq("id", editingNews.id);
        if (error) throw error;
        toast.success("Article updated");
      } else {
        const { error } = await supabase.from("campus_news").insert([newsData]);
        if (error) throw error;
        toast.success("Article created");
      }

      setIsDialogOpen(false);
      setEditingNews(null);
      setImageFile(null);
      fetchNews();
    } catch (error: any) {
      toast.error(error.message || "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try {
      const { error } = await supabase.from("campus_news").delete().eq("id", id);
      if (error) throw error;
      toast.success("Article deleted");
      fetchNews();
    } catch (error) {
      toast.error("Failed to delete article");
    }
  };

  const togglePublish = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("campus_news")
        .update({
          is_published: !currentState,
          published_at: !currentState ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentState ? "Article unpublished" : "Article published");
      fetchNews();
    } catch (error) {
      toast.error("Failed to update article");
    }
  };

  const filteredNews = news.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <SEO title="Campus News | Admin" description="Manage campus news articles" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Campus News</h1>
            <p className="text-muted-foreground">Manage news articles and announcements</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingNews(emptyNews)}>
                <Plus className="w-4 h-4 mr-2" /> Add Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingNews?.id ? "Edit Article" : "Add New Article"}</DialogTitle>
                <DialogDescription>Enter article details below.</DialogDescription>
              </DialogHeader>

              {editingNews && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={editingNews.title || ""}
                      onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editingNews.category || "general"}
                        onValueChange={(value) => setEditingNews({ ...editingNews, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Author</Label>
                      <Input
                        value={editingNews.author || ""}
                        onChange={(e) => setEditingNews({ ...editingNews, author: e.target.value })}
                        placeholder="ResKonnect Team"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Excerpt</Label>
                    <Textarea
                      value={editingNews.excerpt || ""}
                      onChange={(e) => setEditingNews({ ...editingNews, excerpt: e.target.value })}
                      rows={2}
                      placeholder="Brief summary for previews"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Content *</Label>
                    <Textarea
                      value={editingNews.content || ""}
                      onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Featured Image</Label>
                    <div className="space-y-2">
                      {editingNews.image_url && (
                        <img src={editingNews.image_url} alt="Preview" className="w-full h-32 object-cover rounded" />
                      )}
                      <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Publish immediately</Label>
                    <Switch
                      checked={editingNews.is_published ?? false}
                      onCheckedChange={(checked) => setEditingNews({ ...editingNews, is_published: checked })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Article"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredNews.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No articles found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNews.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium max-w-xs truncate">{article.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{article.category}</Badge>
                        </TableCell>
                        <TableCell>{article.author || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={article.is_published ? "default" : "outline"}>
                            {article.is_published ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePublish(article.id, article.is_published)}
                          >
                            {article.is_published ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingNews(article);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(article.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminNews;
