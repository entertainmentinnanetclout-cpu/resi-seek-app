-- Source parity for the production RG1/RG2 release-gate state.
insert into public.virtual_tour_release_registry(release_key,release_name,status,phases,metadata) values
('rg1','360 Studio V2 · Internal Capture Prototype','active',array[0,1,2,3],jsonb_build_object('version','v2','gate','live','capture','guided_mobile','offline',true)),
('rg2','360 Studio V2 · End-to-End Virtual Tour','active',array[4,5,6],jsonb_build_object('version','v2','gate','live','delivery','4k','versioned_publish',true))
on conflict (release_key) do update
set release_name=excluded.release_name,status=excluded.status,phases=excluded.phases,metadata=excluded.metadata,updated_at=now();
