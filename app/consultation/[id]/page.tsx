"use client";
import { useParams } from "next/navigation";
import Consultation from "@/components/Consultation";
export default function ConsultationPage() { const params = useParams<{ id: string }>(); const id = Number(params.id); return Number.isInteger(id) ? <Consultation id={id} /> : <main className="wrap"><p>That consultation was not found.</p></main>; }
