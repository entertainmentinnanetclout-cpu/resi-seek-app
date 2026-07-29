import React, { useState } from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calculator, Sparkles, RefreshCw, Award, Info, FileText, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";
import { RESKONNECT_BRAND } from "@/constants/brand";

interface SubjectRow {
  name: string;
  mark: number; // 0 to 100
}

const DEFAULT_SUBJECTS: SubjectRow[] = [
  { name: "English Home Language / First Additional", mark: 0 },
  { name: "First Additional Language / Home Language", mark: 0 },
  { name: "Mathematics or Mathematical Literacy", mark: 0 },
  { name: "Life Orientation", mark: 0 },
  { name: "Elective Subject 1", mark: 0 },
  { name: "Elective Subject 2", mark: 0 },
  { name: "Elective Subject 3", mark: 0 },
];

export const ApplicationsChecker: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectRow[]>(DEFAULT_SUBJECTS);
  const [calculatedAPS, setCalculatedAPS] = useState<number | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const handleMarkChange = (index: number, val: string) => {
    const markNum = Math.min(100, Math.max(0, parseInt(val) || 0));
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], mark: markNum };
      return next;
    });
  };

  const handleSubjectNameChange = (index: number, val: string) => {
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: val };
      return next;
    });
  };

  const calculateNSCLevel = (mark: number): number => {
    if (mark >= 80) return 7;
    if (mark >= 70) return 6;
    if (mark >= 60) return 5;
    if (mark >= 50) return 4;
    if (mark >= 40) return 3;
    if (mark >= 30) return 2;
    return 1;
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    let totalAPS = 0;
    subjects.forEach((sub) => {
      const isLO = sub.name.toLowerCase().includes("life orientation");
      const level = calculateNSCLevel(sub.mark);
      totalAPS += level;
    });

    setCalculatedAPS(totalAPS);

    if (totalAPS >= 30) {
      setResultSummary(
        "Strong Bachelor eligibility. You meet the typical minimum score threshold for many University degree programs. Focus on matching with top universities and preparing document checklists."
      );
    } else if (totalAPS >= 22) {
      setResultSummary(
        "Strong Diploma or Certificate eligibility. You meet requirements for numerous University diplomas, Private College tracks, and specialized TVET programs."
      );
    } else if (totalAPS >= 15) {
      setResultSummary(
        "TVET and Higher Certificate pathway recommended. Excellent potential for practical engineering, business management NATED tracks, or vocational courses."
      );
    } else {
      setResultSummary(
        "Vocational courses or rewriting guidance suggested. Focus on TVET NC(V) courses, foundational certificates, or upgrading academic marks."
      );
    }
  };

  const handleReset = () => {
    setSubjects(DEFAULT_SUBJECTS.map((s) => ({ ...s, mark: 0 })));
    setCalculatedAPS(null);
    setResultSummary(null);
  };

  return (
    <PublicLayout>
      <SEO
        title="APS Calculator | Marks & Admission Point Score Readiness | ResKonnect"
        description="Estimate your South African National Senior Certificate (NSC) Admission Point Score (APS) with our fast, free online checker. Safe, trusted, and guided."
      />

      <div className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12 max-w-5xl">

          {/* Page Title Header */}
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 text-[#2563EB] px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">
              <Calculator className="w-4 h-4" /> Academic Planning Tools
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#071326] tracking-tight">
              South African NSC APS Calculator
            </h1>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed">
              Calculate your estimated Admission Point Score (APS) instantly. Enter your final or trial NSC school marks below to evaluate potential academic directions.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Subjects Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                <h3 className="font-bold text-[#071326] text-base">NSC Subjects & Marks</h3>
                <span className="text-[10px] text-[#2563EB] font-bold uppercase tracking-wider bg-blue-50 border border-blue-100 rounded px-2 py-0.5">7 Subjects</span>
              </div>

              <form onSubmit={handleCalculate} className="space-y-4">
                {subjects.map((sub, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`sub-name-${idx}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Subject {idx + 1}
                      </Label>
                      {idx < 4 ? (
                        <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs flex items-center text-slate-700 font-bold select-none">
                          {sub.name}
                        </div>
                      ) : (
                        <Input
                          id={`sub-name-${idx}`}
                          value={sub.name}
                          onChange={(e) => handleSubjectNameChange(idx, e.target.value)}
                          placeholder="Elective Subject name..."
                          className="h-10 text-xs border-slate-200 focus:border-[#2563EB]"
                        />
                      )}
                    </div>

                    <div className="w-24 space-y-1 shrink-0">
                      <Label htmlFor={`sub-mark-${idx}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Mark (%)
                      </Label>
                      <Input
                        id={`sub-mark-${idx}`}
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={sub.mark || ""}
                        onChange={(e) => handleMarkChange(idx, e.target.value)}
                        placeholder="0"
                        className="h-10 text-xs text-center border-slate-200 font-bold focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={handleReset} className="border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs h-10 px-4">
                    <RefreshCw className="h-4 w-4 mr-1.5" /> Reset
                  </Button>
                  <Button type="submit" className="flex-1 bg-[#2563EB] hover:bg-[#2F6EDB] text-white font-bold text-xs h-10">
                    Calculate Estimated APS
                  </Button>
                </div>
              </form>
            </div>

            {/* Right Column: Calculator Result & Scale info */}
            <div className="lg:col-span-5 space-y-6">

              {/* Score Results Card */}
              {calculatedAPS !== null && resultSummary !== null ? (
                <Card className="border-2 border-[#12A870] bg-[#12A870]/5 shadow-sm rounded-xl overflow-hidden">
                  <CardContent className="p-6 text-center space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Estimated Admission Point Score
                      </h3>
                      <p className="text-6xl font-black text-[#12A870]">
                        {calculatedAPS}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-700 tracking-wide uppercase">
                        NSC scale compliant
                      </p>
                    </div>

                    <div className="space-y-2 bg-white p-4 rounded-lg border border-emerald-100 text-left">
                      <h4 className="font-bold text-xs flex items-center gap-2 text-emerald-950 uppercase tracking-wider">
                        <Sparkles className="h-4 w-4 text-[#F5B32F]" />
                        Pathway Guidance
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {resultSummary}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <Button asChild className="w-full bg-[#2563EB] text-white hover:bg-[#2F6EDB] font-bold text-xs h-10">
                        <Link to="/get-started?persona=applicant&need=application_support">
                          Get Guided Application Support
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-10">
                        <Link to="/findmyres">
                          Find Accommodations Nearby
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 shadow-sm rounded-xl">
                  <CardContent className="p-8 text-center space-y-4">
                    <Calculator className="h-10 w-10 text-slate-400 mx-auto" />
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Awaiting Marks Input</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Fill out your NSC subject marks in the editor checklist on the left and tap "Calculate Estimated APS" to see guidelines.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Admission Criteria Details */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm">
                <h4 className="font-bold text-xs text-[#071326] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#2563EB]" /> Achievement Scales Reference
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-600">
                  <div className="flex items-center justify-between border-r border-slate-100 pr-3">
                    <span>80% - 100%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 7</span>
                  </div>
                  <div className="flex items-center justify-between pl-1">
                    <span>70% - 79%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 6</span>
                  </div>
                  <div className="flex items-center justify-between border-r border-slate-100 pr-3">
                    <span>60% - 69%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 5</span>
                  </div>
                  <div className="flex items-center justify-between pl-1">
                    <span>50% - 59%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 4</span>
                  </div>
                  <div className="flex items-center justify-between border-r border-slate-100 pr-3">
                    <span>40% - 49%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 3</span>
                  </div>
                  <div className="flex items-center justify-between pl-1">
                    <span>30% - 39%</span>
                    <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded">Level 2</span>
                  </div>
                  <div className="col-span-2 text-center text-slate-400 text-[10px] pt-1">
                    * Life Orientation counts differently depending on selected institution guidelines.
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </PublicLayout>
  );
};

export default ApplicationsChecker;