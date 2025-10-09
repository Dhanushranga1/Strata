"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, CircuitBoard, Inbox, Shield } from "lucide-react";

const valueProps = [
  { 
    icon: Bot, 
    title: "Shows its work", 
    description: "RAG over your KB with inline citations you can verify.",
    color: "text-[rgb(var(--brand))]"
  },
  { 
    icon: Inbox, 
    title: "Built for reps", 
    description: "Queues, assignment, priorities, and one-click escalation.",
    color: "text-[rgb(var(--accent))]"
  },
  { 
    icon: CircuitBoard, 
    title: "Frictionless ingest", 
    description: "Drop in PDF, DOCX, MD, TXT; we chunk, embed, and dedupe.",
    color: "text-[rgb(var(--success))]"
  },
  { 
    icon: Shield, 
    title: "Enterprise ready", 
    description: "Roles, audit trail, and secure data handling.",
    color: "text-[rgb(var(--warning))]"
  },
];

export default function ValueProps() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <div className="text-center mb-16">
        <motion.h2
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl lg:text-4xl font-bold tracking-tight text-[rgb(var(--text))] font-geist mb-4"
        >
          Everything you need to scale support
        </motion.h2>
        <motion.p
          initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
          whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg text-[rgb(var(--muted))] max-w-2xl mx-auto"
        >
          From AI-powered answers to enterprise-grade security, TicketPilot has everything your support team needs.
        </motion.p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {valueProps.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <motion.div 
              key={item.title}
              initial={prefersReduced ? {} : { opacity: 0, y: 8 }}
              whileInView={prefersReduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card 
                className="h-full bg-[rgb(var(--surface))] border border-[rgb(var(--muted))]/20 hover:border-[rgb(var(--muted))]/40 transition-colors duration-200"
                shadow="sm"
              >
                <CardHeader className="flex flex-col items-start gap-3 pb-2">
                  <div className="p-2 rounded-lg bg-[rgb(var(--bg))]">
                    <IconComponent className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg text-[rgb(var(--text))] font-geist">
                    {item.title}
                  </h3>
                </CardHeader>
                <CardBody className="pt-0">
                  <p className="text-[rgb(var(--muted))] leading-relaxed">
                    {item.description}
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}