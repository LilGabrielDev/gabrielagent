"use client";

import Link from "next/link";
import { siteMapSections } from "@/components/dashboard/quick-actions";
import { Header } from "@/components/layout/header";
import { ArrowRight, ExternalLink } from "lucide-react";

export default function HelpPage() {
  return (
    <>
      <Header
        title="Help & Sitemap"
        description="All Gabriel pages and where to find each feature"
      />
      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-4xl">
        <div className="bg-gabriel-surface rounded-xl border border-gabriel-border p-5">
          <h3 className="font-semibold text-gabriel-text mb-2">Getting started</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gabriel-text-light">
            <li>
              Configure your business profile and AI key in{" "}
              <Link href="/settings" className="text-gabriel-primary hover:underline">
                Settings
              </Link>
            </li>
            <li>
              Add knowledge base articles under{" "}
              <Link href="/knowledge" className="text-gabriel-primary hover:underline">
                Knowledge Base
              </Link>
              , then test with{" "}
              <Link href="/knowledge/test" className="text-gabriel-primary hover:underline">
                Test Knowledge
              </Link>
            </li>
            <li>
              Connect WhatsApp on{" "}
              <Link href="/channels" className="text-gabriel-primary hover:underline">
                Channels
              </Link>{" "}
              (host <code className="text-xs bg-gabriel-bg px-1 rounded">whatsapp-service</code> on
              Katabump and set <code className="text-xs bg-gabriel-bg px-1 rounded">WHATSAPP_SERVICE_URL</code>)
            </li>
            <li>
              Monitor inbox at{" "}
              <Link href="/conversations" className="text-gabriel-primary hover:underline">
                Conversations
              </Link>
            </li>
          </ol>
        </div>

        {siteMapSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gabriel-text-light mb-3">
              {section.title}
            </h3>
            <div className="grid gap-2">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 px-4 py-3 bg-gabriel-surface border border-gabriel-border rounded-lg hover:border-gabriel-primary/40 hover:bg-gabriel-primary-50/30 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-gabriel-bg">
                    <item.icon className="h-4 w-4 text-gabriel-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gabriel-text">{item.name}</p>
                    <p className="text-xs text-gabriel-text-light">{item.desc}</p>
                  </div>
                  <code className="text-xs text-gabriel-text-light hidden sm:block">{item.href}</code>
                  <ArrowRight className="h-4 w-4 text-gabriel-text-light group-hover:text-gabriel-primary flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-gabriel-bg rounded-xl border border-gabriel-border p-5">
          <h3 className="font-semibold text-gabriel-text mb-2">Public API</h3>
          <p className="text-sm text-gabriel-text-light mb-3">
            Health check and OpenAPI spec (no auth required for health):
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gabriel-primary hover:underline"
              >
                /api/health
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <Link href="/api-docs" className="text-gabriel-primary hover:underline">
                /api-docs — interactive API reference
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
