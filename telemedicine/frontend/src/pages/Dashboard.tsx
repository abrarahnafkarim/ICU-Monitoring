import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScrollText, Siren } from "lucide-react";

import { api } from "../api/client";
import { AlertPanel } from "../components/AlertPanel";
import { CameraFeed } from "../components/CameraFeed";
import { DoctorComments } from "../components/DoctorComments";
import { EcgChart } from "../components/EcgChart";
import { Navbar } from "../components/Navbar";
import { PatientProfileCard } from "../components/PatientProfileCard";
import { SensorStatusPanel } from "../components/SensorStatusPanel";
import { VitalsGrid } from "../components/VitalsGrid";
import { usePatient } from "../hooks/usePatient";
import { useVitals } from "../hooks/useVitals";
import { computeAlerts } from "../lib/alerts";

export function Dashboard() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const { vitals, status } = useVitals(patient.patient_id);
  const alerts = useMemo(() => computeAlerts(vitals), [vitals]);

  return (
    <div className="min-h-screen">
      <Navbar online={status === "online"} showBack />

      <main className="safe-bottom mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-6 sm:px-6">
        <div className="animate-fade-in">
          <PatientProfileCard patient={patient} />
        </div>

        <section className="animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Live Vitals</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigate(`/dashboard/${patient.patient_id}/log`)
                }
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <ScrollText size={14} strokeWidth={2.2} />
                Log Overview
              </button>
              <button
                onClick={() => api.simulateAnomaly(patient.patient_id).catch(() => {})}
                title="Demo: briefly force an abnormal vital to test alerts"
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Siren size={14} strokeWidth={2.2} />
                Simulate alert
              </button>
            </div>
          </div>
          <VitalsGrid vitals={vitals} />
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Centerpiece: live ECG */}
          <div className="animate-fade-in lg:col-span-8">
            <EcgChart patientId={patient.patient_id} />
          </div>

          {/* Side column: camera + sensors + alerts */}
          <div className="flex flex-col gap-5 lg:col-span-4">
            <div className="animate-fade-in">
              <CameraFeed />
            </div>
            <div className="animate-fade-in">
              <SensorStatusPanel />
            </div>
            <div className="animate-fade-in">
              <AlertPanel alerts={alerts} />
            </div>
            <div className="animate-fade-in">
              <DoctorComments patientId={patient.patient_id} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
