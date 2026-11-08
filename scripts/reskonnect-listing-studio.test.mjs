import test from "node:test";
import assert from "node:assert/strict";
import {listingStudioIssues,listingMinimumPrivateRent,isUploadedResidencePhoto} from "../src/lib/listingStudioRules.ts";

const residenceId="11111111-1111-4111-8111-111111111111";
const photo=(name)=>"https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/"+residenceId+"/studio/"+name+".jpg";
const complete=()=>({
 name:"Controlled Test Residence",city:"Pretoria",place_label:"Hatfield",
 address:"1 Controlled Example Street",description:"A real listing needs a meaningful description. This test has the necessary length but refers only to a fabricated sample residence.",
 rooms:[{name:"Single room",capacity:4,available_beds:2,private_price:3600,deposit:500},
        {name:"Sharing room",capacity:8,available_beds:6,private_price:2500,deposit:500}],
 photos:[{url:photo("1")},{url:photo("2")},{url:photo("3")}],
 lease_period:"10 months",move_in_date:"2027-01-15",
 verification_method:"staff_review",agree_terms:true
});
test("valid room-group listing passes the shared readiness requirements",()=>{
 const listing=complete();
 assert.deepEqual(listingStudioIssues(listing),[]);
 assert.equal(listingMinimumPrivateRent(listing.rooms),2500);
 assert.equal(listing.rooms.reduce((n,r)=>n+r.capacity,0),12);
 assert.equal(listing.rooms.reduce((n,r)=>n+r.available_beds,0),8);
});
test("room availability cannot exceed capacity and duplicate room names cannot pass",()=>{
 const listing=complete();listing.rooms[0].available_beds=7;listing.rooms[1].name="single ROOM";
 const issues=listingStudioIssues(listing);
 assert.ok(issues.some(x=>x.includes("availability")||x.includes("capacity")));
 assert.ok(issues.some(x=>x.includes("unique")));
});
test("verified submission needs real photos, accurate text and terms",()=>{
 const listing=complete();listing.photos=[];listing.agree_terms=false;listing.description="Hi";
 const errors=listingStudioIssues(listing);
 assert.ok(errors.some(x=>x.includes("three")));
 assert.ok(errors.some(x=>x.includes("80")));
 assert.ok(errors.some(x=>x.includes("terms")));
});
test("residence gallery only accepts this property's public storage paths",()=>{
 assert.equal(isUploadedResidencePhoto(photo("photo-a"),residenceId),true);
 for(const url of [
 "https://malicious.test/property.jpg",
 "https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/sign/application-documents/id.jpg",
 photo("pic")+"?token=secret",
 photo("../secret"),
 "https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/22222222-2222-4222-8222-222222222222/studio/photo.jpg",
 ])assert.equal(isUploadedResidencePhoto(url,residenceId),false);
});
test("pricing helper returns no fabricated rate when prices are not configured",()=>{
 assert.equal(listingMinimumPrivateRent([]),null);
 assert.equal(listingMinimumPrivateRent([{name:"Sample",capacity:1,available_beds:0,private_price:0,deposit:0}]),null);
});
