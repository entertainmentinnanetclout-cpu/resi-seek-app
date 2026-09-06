import fs from "node:fs";

const replaceFile = (path, transform) => {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`updated ${path}`);
  } else {
    console.log(`unchanged ${path}`);
  }
};

const visibleDimphoFiles = [
  "src/components/admin/AdminOSWhatsAppDeskNext.tsx",
  "src/components/admin/AdminOSWhatsAppConcierge.tsx",
  "src/components/admin/AdminOSResidenceReadiness.tsx",
  "src/components/AutomationAdvantageSection.tsx",
  "src/pages/admin/AdminSystemHub.tsx",
];

for (const path of visibleDimphoFiles) {
  replaceFile(path, (text) => text.replaceAll("Luna", "Dimpho"));
}

replaceFile("src/components/admin/AdminOSWhatsAppDeskNext.tsx", (text) => {
  if (!text.includes('from "react-router-dom"')) {
    text = text.replace(
      'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\n',
      'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useSearchParams } from "react-router-dom";\n',
    );
  }
  if (!text.includes("const [searchParams]=useSearchParams();")) {
    text = text.replace(
      "export default function AdminOSWhatsAppDeskNext(){\n",
      "export default function AdminOSWhatsAppDeskNext(){\n  const [searchParams]=useSearchParams();\n",
    );
  }
  text = text.replace(
    'const [selectedId,setSelectedId]=useState<string|null>(null);',
    'const [selectedId,setSelectedId]=useState<string|null>(()=>searchParams.get("thread"));',
  );
  return text;
});

replaceFile("src/pages/admin/AdminSystemHub.tsx", (text) => {
  if (!text.includes('AdminOSServiceIntelligence')) {
    text = text.replace(
      'import AdminOSResidenceReadiness from "@/components/admin/AdminOSResidenceReadiness";\n',
      'import AdminOSResidenceReadiness from "@/components/admin/AdminOSResidenceReadiness";\nimport AdminOSServiceIntelligence from "@/components/admin/AdminOSServiceIntelligence";\nimport AdminOSCustomer360 from "@/components/admin/AdminOSCustomer360";\n',
    );
  }
  if (!text.includes('const customerId=searchParams.get("contact")')) {
    text = text.replace(
      '  const activeTab=normalize(searchParams.get("tab"));\n',
      '  const activeTab=normalize(searchParams.get("tab"));\n  const customerId=searchParams.get("contact");\n  const closeCustomer=()=>{const next=new URLSearchParams(searchParams);next.delete("contact");setSearchParams(next,{replace:true});};\n',
    );
  }
  text = text.replace(
    '<TabsContent value="automation" className="space-y-5"><AutomationQueueContent/>',
    '<TabsContent value="automation" className="space-y-5"><AdminOSServiceIntelligence/><AutomationQueueContent/>',
  );
  if (!text.includes('<AdminOSCustomer360 contactId={customerId}')) {
    text = text.replace(
      '      </Tabs>\n    </div>\n  </AdminLayout>;',
      '      </Tabs>\n      <AdminOSCustomer360 contactId={customerId} open={Boolean(customerId)} onClose={closeCustomer}/>\n    </div>\n  </AdminLayout>;',
    );
  }
  return text;
});

console.log("Dimpho release wiring complete");
