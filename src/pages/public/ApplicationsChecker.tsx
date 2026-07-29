import React, { useState } from "react";
import PublicLayout from "@/components/PublicLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calculator, Sparkles, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import ComplianceDisclaimer from "@/components/onboarding/ComplianceDisclaimer";

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
      // LO is excluded by some universities or counts for fewer points.
      // Standard calculation: Sum 6 subjects, optionally include LO at 50% or full.
      // We will follow a standard NSC 7-subject calculation, counting LO fully or standard 6-subject sum
      const isLO = sub.name.toLowerCase().includes("life orientation");
      const level = calculateNSCLevel(sub.mark);
      if (isLO) {
        // Standard SA universities: LO is either excluded or counts at max 1-3 points.
        // For simplicity of a robust guideline: we calculate LO level normally but note university differences.
        totalAPS += level;
      } else {
        totalAPS += level;
      }
    });

    setCalculatedAPS(totalAPS);

    // Provide generic academic pathway advice
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
        title="APS Calculator | Marks & Admission Point Score Readiness"
        description="Estimate your South African National Senior Certificate (NSC) Admission Point Score (APS) with our fast, free online checker."
      />

      <div className="py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Calculator className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-4xl font-extrabold tracking-tight">
              South African NSC APS Calculator
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Calculate your estimated Admission Point Score (APS) instantly. Enter your subjects and final or trial marks below.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <ComplianceDisclaimer />
          </div>

          <div className="max-w-4xl mx-auto rounded-xl border border-primary/20 bg-muted/40 p-4 text-xs text-muted-foreground flex gap-3 items-start leading-relaxed">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p>
              <strong>Disclaimer:</strong> This checker gives guidance only. Final admission depends on the official institution, programme requirements, verified results, available space, and application period.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-start">
            <form onSubmit={handleCalculate} className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="font-bold text-lg border-b pb-2">Enter Your Marks (0 - 100%)</h3>

              <div className="space-y-4">
                {subjects.map((sub, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`sub-name-${idx}`} className="text-xs font-semibold text-muted-foreground">
                        Subject {idx + 1}
                      </Label>
                      {idx < 4 ? (
                        <div className="h-10 px-3 rounded-md border border-input bg-muted/30 text-sm flex items-center text-foreground font-semibold">
                          {sub.name}
                        </div>
                      ) : (
                        <Input
                          id={`sub-name-${idx}`}
                          value={sub.name}
                          onChange={(e) => handleSubjectNameChange(idx, e.target.value)}
                          placeholder="Enter Subject Name"
                        />
                      )}
                    </div>

                    <div className="w-24 space-y-1 shrink-0">
                      <Label htmlFor={`sub-mark-${idx}`} className="text-xs font-semibold text-muted-foreground">
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
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleReset} className="flex gap-2 items-center">
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </Button>
                <Button type="submit" className="flex-1">
                  Calculate APS
                </Button>
              </div>
            </form>

            <div className="space-y-6">
              {calculatedAPS !== null && resultSummary !== null ? (
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-8 text-center space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        Your Estimated APS Score
                      </h3>
                      <p className="text-7xl font-black text-primary">
                        {calculatedAPS}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Summed from 7 subjects (using NSC achievement scales)
                      </p>
                    </div>

                    <div className="space-y-3 bg-card p-4 rounded-xl border text-left">
                      <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        Pathway Guideline:
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {resultSummary}
                      </p>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button asChild className="w-full font-bold">
                        <Link to="/get-started?persona=applicant&need=application_support">
                          Get Guided Application Support
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/find">
                          Find Accommodation Near Campus
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="p-8 text-center space-y-4">
                    <Calculator className="h-12 w-12 text-muted-foreground mx-auto animate-bounce" />
                    <h3 className="font-bold text-lg text-foreground">Awaiting Input</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Fill out your marks inside the NSC Subjects checklist on the left and tap "Calculate APS" to evaluate potential academic directions.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="bg-card p-6 rounded-2xl border space-y-4 text-sm leading-normal">
                <h4 className="font-bold text-base border-b pb-1">NSC Level Achievement Scale</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>80% - 100% = <span className="font-bold text-primary">Level 7</span></div>
                  <div>70% - 79% = <span className="font-bold text-primary">Level 6</span></div>
                  <div>60% - 69% = <span className="font-bold text-primary">Level 5</span></div>
                  <div>50% - 59% = <span className="font-bold text-primary">Level 4</span></div>
                  <div>40% - 49% = <span className="font-bold text-primary">Level 3</span></div>
                  <div>30% - 39% = <span className="font-bold text-primary">Level 2</span></div>
                  <div className="col-span-2">0% - 29% = <span className="font-bold text-primary">Level 1</span></div>
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