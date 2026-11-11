-- ResKonnect Visual AdminOS: secure publishable page slots, revisions and stable residence links.
CREATE TABLE IF NOT EXISTS public.residence_slug_aliases (
 old_slug text PRIMARY KEY,
 residence_id uuid NOT NULL REFERENCES public.residences(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rk_slug_alias_valid CHECK (old_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
CREATE INDEX IF NOT EXISTS rk_residence_slug_alias_target_idx ON public.residence_slug_aliases(residence_id);
ALTER TABLE public.residence_slug_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.residence_slug_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.residence_slug_aliases TO anon, authenticated;
DROP POLICY IF EXISTS "Visible residence legacy slugs" ON public.residence_slug_aliases;
CREATE POLICY "Visible residence legacy slugs" ON public.residence_slug_aliases FOR SELECT TO anon, authenticated
 USING (EXISTS(SELECT 1 FROM public.residences r WHERE r.id=residence_id AND r.is_visible=true));

CREATE UNIQUE INDEX IF NOT EXISTS rk_residences_slug_ci_unique ON public.residences(lower(slug)) WHERE slug IS NOT NULL;
CREATE OR REPLACE FUNCTION public.generate_residence_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base text; final text; n integer:=0;
BEGIN
 IF TG_OP='UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND nullif(btrim(NEW.slug),'') IS NOT NULL
 THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND nullif(btrim(NEW.slug),'') IS NOT NULL
 THEN RETURN NEW; END IF;
 base:=trim(both '-' from regexp_replace(lower(coalesce(NEW.name,'residence')),'[^a-z0-9]+','-','g'));
 IF base='' THEN base:='residence'; END IF;
 final:=base;
 WHILE EXISTS(SELECT 1 FROM public.residences WHERE lower(slug)=final AND id IS DISTINCT FROM NEW.id)
   OR EXISTS(SELECT 1 FROM public.residence_slug_aliases WHERE old_slug=final)
 LOOP
  n:=n+1; final:=base||'-'||n;
 END LOOP;
 NEW.slug:=final;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.rk_record_residence_slug_alias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.slug IS DISTINCT FROM NEW.slug AND nullif(OLD.slug,'') IS NOT NULL THEN
  INSERT INTO public.residence_slug_aliases(old_slug,residence_id)
  VALUES(lower(OLD.slug),NEW.id) ON CONFLICT(old_slug) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.rk_record_residence_slug_alias() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS rk_residence_slug_alias_event ON public.residences;
CREATE TRIGGER rk_residence_slug_alias_event AFTER UPDATE OF slug ON public.residences
FOR EACH ROW EXECUTE FUNCTION public.rk_record_residence_slug_alias();
UPDATE public.residences SET slug=NULL
WHERE id='3824a8f4-2ef7-406d-996b-2f2f7785dd74'::uuid
 AND name='Villa Ubuntu Student Accommodation' AND slug='ekhaya-junction';

CREATE TABLE IF NOT EXISTS public.rk_visual_page_sections (
 page_key text NOT NULL CHECK(page_key IN ('landing','findmyres')),
 section_key text NOT NULL CHECK(section_key ~ '^[a-z][a-z0-9-]{1,60}$'),
 title text NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 10000),
 visible boolean NOT NULL DEFAULT true,
 required boolean NOT NULL DEFAULT false,
 editable_copy boolean NOT NULL DEFAULT false,
 headline text NOT NULL DEFAULT '',
 subtitle text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 PRIMARY KEY(page_key,section_key),
 CONSTRAINT rk_visual_required_visible CHECK(NOT required OR visible)
);
ALTER TABLE public.rk_visual_page_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rk_visual_page_sections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rk_visual_page_sections TO anon,authenticated;
DROP POLICY IF EXISTS rk_visual_public_select ON public.rk_visual_page_sections;
CREATE POLICY rk_visual_public_select ON public.rk_visual_page_sections FOR SELECT TO anon,authenticated USING(true);
INSERT INTO public.rk_visual_page_sections(page_key,section_key,title,position,required,editable_copy,headline,subtitle)
 VALUES
('landing','hero','Homepage hero',10,true,false,'',''),
('landing','search','Accommodation search',20,true,false,'',''),
('landing','spotlight','Priority Spotlight',30,false,true,'Find your next address through ResKonnect Living.','Our ResKonnect Spotlight puts selected accommodation upfront. Compare authentic listing photos, landlord-reported rents and neighbourhood details.'),
('landing','top3','Top 3 of the month',40,false,true,'ResKonnect Top 3 of the month.','Student-interest trends and clearly marked editorial selections.'),
('landing','vision','Our vision',50,true,false,'',''),
('landing','cities','Cities and accommodation',60,false,false,'',''),
('landing','pillars','Living · AI · Opportunity',70,true,false,'',''),
('landing','gmail-privacy','Google privacy information',80,true,false,'',''),
('landing','student-care','Student care',90,false,false,'',''),
('landing','intake','Student pathways',100,false,false,'',''),
('landing','automation','Connected services',110,false,false,'',''),
('landing','resmap','ResMap preview',120,false,false,'',''),
('landing','audience','Find by audience',130,false,false,'',''),
('landing','trusted','Trusted accommodation',140,false,true,'Explore ResKonnect''s curated residence network.','Compare real listing photos and property information. Editorial selection does not establish accreditation.'),
('landing','categories','Accommodation categories',150,false,false,'',''),
('landing','accreditation','Accreditation guidance',160,true,false,'',''),
('landing','about','About ResKonnect',170,true,false,'',''),
('landing','landlord','Landlord enquiry',180,true,false,'',''),
('landing','benefits','Why ResKonnect',190,false,false,'',''),
('landing','faq','Platform FAQ',200,true,false,'',''),
('landing','contact','Contact us',210,true,false,'',''),
('landing','seo-links','Explore more',220,true,false,'',''),
('findmyres','search','Smart accommodation search',10,true,false,'',''),
('findmyres','spotlight','Priority Spotlight',20,false,true,'Find your next address through ResKonnect Living.','Premium curated accommodation on ResKonnect.'),
('findmyres','top3','Top 3 of the month',30,false,true,'ResKonnect Top 3 of the month.','Student-interest trends and editorial selections.'),
('findmyres','nearby','Nearby residences',40,false,false,'',''),
('findmyres','sponsored','Sponsored residence placements',50,false,false,'',''),
('findmyres','referral','Referral banner',60,false,false,'',''),
('findmyres','audience','Audience filters',70,true,false,'',''),
('findmyres','results','Accommodation results',80,true,true,'Discover student living the ResKonnect way','Your filters shape these results. Residence-reported availability is not a booking guarantee.'),
('findmyres','category-rails','Explore by category',90,false,false,'',''),
('findmyres','seo-info','Search information',100,true,false,'','')
 ON CONFLICT(page_key,section_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rk_visual_page_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 page_key text NOT NULL CHECK(page_key IN ('landing','findmyres')),
 revision integer NOT NULL CHECK(revision>0),
 state text NOT NULL CHECK(state IN('draft','published')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='array'),
 note text,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 UNIQUE(page_key,revision)
);
CREATE INDEX IF NOT EXISTS rk_visual_revisions_page_idx ON public.rk_visual_page_revisions(page_key,created_at DESC);
ALTER TABLE public.rk_visual_page_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rk_visual_page_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rk_visual_page_revisions TO authenticated;
DROP POLICY IF EXISTS rk_visual_admin_history ON public.rk_visual_page_revisions;
CREATE POLICY rk_visual_admin_history ON public.rk_visual_page_revisions FOR SELECT TO authenticated
 USING (public.has_role((select auth.uid()),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.rk_visual_page_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 page_key text NOT NULL,
 revision_id uuid NOT NULL REFERENCES public.rk_visual_page_revisions(id),
 action text NOT NULL CHECK(action IN ('draft','published','rollback')),
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rk_visual_page_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rk_visual_page_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rk_visual_page_audit TO authenticated;
DROP POLICY IF EXISTS rk_visual_admin_audit_read ON public.rk_visual_page_audit;
CREATE POLICY rk_visual_admin_audit_read ON public.rk_visual_page_audit FOR SELECT TO authenticated
 USING (public.has_role((select auth.uid()),'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.rk_visual_save_page(p_page text,p_snapshot jsonb,p_publish boolean DEFAULT false,p_note text DEFAULT NULL,p_rollback boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); item jsonb; key text; slot public.rk_visual_page_sections%ROWTYPE; actual integer; proposed integer:=0; latest integer; rev_id uuid; used text[]:=ARRAY[]::text[]; position_value integer;
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'admin'::public.app_role)
    OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
  RAISE EXCEPTION 'God Mode and verified MFA required' USING ERRCODE='42501';
 END IF;
 IF p_page NOT IN('landing','findmyres') OR p_snapshot IS NULL OR jsonb_typeof(p_snapshot)<>'array' THEN
  RAISE EXCEPTION 'Invalid page editor payload' USING ERRCODE='22023';
 END IF;
 SELECT count(*) INTO actual FROM public.rk_visual_page_sections WHERE page_key=p_page;
 IF actual=0 OR jsonb_array_length(p_snapshot)<>actual OR actual>50 THEN
  RAISE EXCEPTION 'All managed sections must be included' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rk-visual-'||p_page));
 FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot) LOOP
  key:=item->>'section_key';
  IF key IS NULL OR key=ANY(used) THEN RAISE EXCEPTION 'Duplicate or missing section key' USING ERRCODE='22023'; END IF;
  used:=array_append(used,key);
  SELECT * INTO slot FROM public.rk_visual_page_sections WHERE page_key=p_page AND section_key=key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown page component' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(item->'visible')<>'boolean' OR jsonb_typeof(item->'position')<>'number'
     OR jsonb_typeof(item->'headline')<>'string' OR jsonb_typeof(item->'subtitle')<>'string'
     THEN RAISE EXCEPTION 'Invalid component fields' USING ERRCODE='22023'; END IF;
  position_value:=(item->>'position')::integer;
  IF position_value<1 OR position_value>10000 OR (slot.required AND (item->>'visible')::boolean=false)
     OR length(item->>'headline')>180 OR length(item->>'subtitle')>450
     THEN RAISE EXCEPTION 'Protected or oversized content' USING ERRCODE='22023'; END IF;
  IF NOT slot.editable_copy AND (item->>'headline'<>slot.headline OR item->>'subtitle'<>slot.subtitle)
     THEN RAISE EXCEPTION 'This page section has protected content' USING ERRCODE='42501'; END IF;
  proposed:=proposed+1;
 END LOOP;
 IF proposed<>actual THEN RAISE EXCEPTION 'Incomplete page update' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(revision),0)+1 INTO latest FROM public.rk_visual_page_revisions WHERE page_key=p_page;
 INSERT INTO public.rk_visual_page_revisions(page_key,revision,state,snapshot,note,created_by,published_at)
 VALUES (p_page,latest,CASE WHEN p_publish THEN 'published' ELSE 'draft' END,p_snapshot,left(p_note,500),actor,CASE WHEN p_publish THEN now() ELSE NULL END)
 RETURNING id INTO rev_id;
 IF p_publish THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot) LOOP
   UPDATE public.rk_visual_page_sections SET
    position=(item->>'position')::integer,visible=(item->>'visible')::boolean,
    headline=item->>'headline',subtitle=item->>'subtitle',
    updated_by=actor,updated_at=now()
   WHERE page_key=p_page AND section_key=item->>'section_key';
  END LOOP;
 END IF;
 INSERT INTO public.rk_visual_page_audit(page_key,revision_id,action,actor_id)
 VALUES(p_page,rev_id,CASE WHEN p_publish THEN CASE WHEN p_rollback THEN 'rollback' ELSE 'published' END ELSE 'draft' END,actor);
 RETURN rev_id;
END $$;
REVOKE ALL ON FUNCTION public.rk_visual_save_page(text,jsonb,boolean,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rk_visual_save_page(text,jsonb,boolean,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.rk_admin_set_trusted_residences(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); selected_count integer; valid_count integer;
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'admin'::public.app_role) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
  RAISE EXCEPTION 'God Mode MFA required' USING ERRCODE='42501';
 END IF;
 selected_count:=coalesce(array_length(p_ids,1),0);
 IF selected_count>30 OR (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x)<>selected_count THEN
  RAISE EXCEPTION 'Choose at most 30 unique residences' USING ERRCODE='22023';
 END IF;
 SELECT count(*) INTO valid_count FROM public.residences
 WHERE id=ANY(coalesce(p_ids,ARRAY[]::uuid[])) AND is_visible=true;
 IF valid_count<>selected_count THEN RAISE EXCEPTION 'Only published residences may be curated' USING ERRCODE='22023'; END IF;
 UPDATE public.residences SET is_trusted=false,display_order=NULL WHERE is_trusted=true;
 UPDATE public.residences r SET is_trusted=true,display_order=src.ord
 FROM unnest(p_ids) WITH ORDINALITY AS src(id,ord) WHERE r.id=src.id;
 RETURN selected_count;
END $$;
REVOKE ALL ON FUNCTION public.rk_admin_set_trusted_residences(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rk_admin_set_trusted_residences(uuid[]) TO authenticated;
