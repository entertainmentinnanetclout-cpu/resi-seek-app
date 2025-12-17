-- Enable realtime for new content tables only
ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_slides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bursaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campus_news;