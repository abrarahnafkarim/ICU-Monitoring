import { useMemo } from "react";

import { AlertPanel } from "../components/AlertPanel";
import { CameraFeed } from "../components/CameraFeed";
import { EcgChart } from "../components/EcgChart";
import { Navbar } from "../components/Navbar";
import { PatientProfileCard } from "../components/PatientProfileCard";
import { SensorStatusPanel } from "../components/SensorStatusPanel";
import { VitalsGrid } from "../components/VitalsGrid";
import { usePatient } from "../hooks/usePatient";
import { useVitals } from "../hooks/useVitals";
import { computeAlerts } from "../lib/alerts";

export function Dashboard() {
  const patient = usePatient();
  const { vitals, status } = useVitals();
  const alerts = useMemo(() => computeAlerts(vitals), [vitals]);

  return (
    <div className="min-h-screen">
      <Navbar online={status === "online"} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="animate-fade-in">
          <PatientProfileCard patient={patient} />
        </div>

        <section className="animate-fade-in">
          <h2 className="section-title mb-3">Live Vitals</h2>
          <VitalsGrid vitals={vitals} />
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Centerpiece: live ECG */}
          <div className="animate-fade-in lg:col-span-8">
            <EcgChart />
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
          </div>
        </div>
      </main>
    </div>
  );
}
