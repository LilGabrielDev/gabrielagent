"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  MessageSquare,
  Contact,
  Ticket,
  BookOpen,
  Zap,
  Workflow,
  Clock,
  Users,
  Timer,
  Radio,
  Webhook,
  BarChart3,
  ScrollText,
  Shield,
  FileCode,
  Settings,
  FlaskConical,
  HelpCircle,
  ArrowRight,
  Megaphone,
  GitBranch,
} from "lucide-react";

const sections = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, desc: "Stats and recent activity" },
      { name: "Help & Sitemap", href: "/help", icon: HelpCircle, desc: "All pages and quick links" },
    ],
  },
  {
    title: "Support",
    items: [
      { name: "Conversations", href: "/conversations", icon: MessageSquare, desc: "Inbox and replies" },
      { name: "Customers", href: "/customers", icon: Contact, desc: "Customer profiles" },
      { name: "Tickets", href: "/tickets", icon: Ticket, desc: "Ticket queue" },
    ],
  },
  {
    title: "Knowledge",
    items: [
      { name: "Knowledge Base", href: "/knowledge", icon: BookOpen, desc: "Articles and categories" },
      { name: "Test Knowledge", href: "/knowledge/test", icon: FlaskConical, desc: "Try AI answers against KB" },
      { name: "Canned Responses", href: "/canned-responses", icon: Zap, desc: "Saved reply templates" },
      { name: "Automation", href: "/automation", icon: Workflow, desc: "Rules and triggers" },
      { name: "Flow Builder", href: "/flows", icon: GitBranch, desc: "Visual conversation flows" },
      { name: "Campaigns", href: "/campaigns", icon: Megaphone, desc: "Outbound messaging campaigns" },
      { name: "Business Hours", href: "/business-hours", icon: Clock, desc: "Availability schedule" },
    ],
  },
  {
    title: "Team & Channels",
    items: [
      { name: "Team", href: "/team", icon: Users, desc: "Members and departments" },
      { name: "SLA Rules", href: "/sla", icon: Timer, desc: "Response time targets" },
      { name: "Channels", href: "/channels", icon: Radio, desc: "WhatsApp, email, phone" },
      { name: "Webhooks", href: "/webhooks", icon: Webhook, desc: "Outbound event hooks" },
    ],
  },
  {
    title: "Insights & System",
    items: [
      { name: "Analytics", href: "/analytics", icon: BarChart3, desc: "Performance metrics" },
      { name: "Activity Log", href: "/activity", icon: ScrollText, desc: "Audit trail" },
      { name: "Administration", href: "/admin", icon: Shield, desc: "Users and API keys" },
      { name: "API Docs", href: "/api-docs", icon: FileCode, desc: "REST reference" },
      { name: "Settings", href: "/settings", icon: Settings, desc: "Business and AI config" },
    ],
  },
];

export function QuickActions() {
  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border overflow-hidden">
      <div className="px-5 py-4 border-b border-gabriel-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gabriel-text">Quick Actions</h3>
          <p className="text-xs text-gabriel-text-light mt-0.5">
            Jump to any section
          </p>
        </div>
        <Link
          href="/help"
          className="text-xs font-medium text-gabriel-primary hover:underline"
        >
          All pages
        </Link>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sections.flatMap((s) => s.items).slice(0, 8).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gabriel-border bg-gabriel-bg hover:border-gabriel-primary/40 hover:bg-gabriel-primary-50/50 transition-colors group"
          >
            <item.icon className="h-4 w-4 text-gabriel-text-light group-hover:text-gabriel-primary flex-shrink-0" />
            <span className="text-xs font-medium text-gabriel-text truncate">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { sections as siteMapSections };
