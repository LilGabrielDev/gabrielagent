"use client";

import { Header } from "@/components/layout/header";
import {
  Megaphone,
  Plus,
  Search,
  X,
  Edit3,
  Trash2,
  Mail,
  MessageCircle,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ==================== TYPES ====================

interface CampaignData {
  id: string;
  name: string;
  description: string;
  channel: string;
  message: string;
  subject: string;
  segments: string[];
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ==================== CONSTANTS ====================

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email", icon: Mail, color: "text-blue-600 bg-blue-50" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600 bg-green-50" },
  { value: "sms", label: "SMS", icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600", icon: FileText },
  scheduled: { label: "Scheduled", color: "bg-blue-50 text-blue-600", icon: Calendar },
  running: { label: "Running", color: "bg-green-50 text-green-600", icon: Play },
  completed: { label: "Completed", color: "bg-gabriel-primary-50 text-gabriel-primary", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-amber-50 text-amber-600", icon: Pause },
};

// ==================== EMPTY STATE ====================

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-gabriel-primary-50 mb-4">
        <Megaphone className="h-8 w-8 text-gabriel-primary" />
      </div>
      <p className="font-semibold text-gabriel-text">
        {filtered ? "No campaigns match your filters" : "No campaigns yet"}
      </p>
      <p className="text-sm text-gabriel-text-light mt-1 max-w-xs">
        {filtered
          ? "Try adjusting your search or status filter."
          : "Create your first campaign to start reaching your customers at scale."}
      </p>
    </div>
  );
}

// ==================== CAMPAIGN FORM ====================

interface CampaignFormProps {
  initial?: Partial<CampaignData>;
  onSave: (data: Partial<CampaignData>) => void;
  onCancel: () => void;
  saving: boolean;
}

function CampaignForm({ initial, onSave, onCancel, saving }: CampaignFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [channel, setChannel] = useState(initial?.channel ?? "email");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : ""
  );
  const [segmentsRaw, setSegmentsRaw] = useState(
    (initial?.segments ?? []).join(", ")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      description: description.trim(),
      channel,
      subject: subject.trim(),
      message: message.trim(),
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      segments: segmentsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  const isEmail = channel === "email";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Campaign Name <span className="text-gabriel-danger">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Summer Promotion"
          className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Channel <span className="text-gabriel-danger">*</span>
        </label>
        <div className="flex gap-2">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChannel(opt.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                channel === opt.value
                  ? "border-gabriel-primary bg-gabriel-primary-50 text-gabriel-primary"
                  : "border-gabriel-border text-gabriel-text-light hover:border-gabriel-primary/50"
              )}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isEmail && (
        <div>
          <label className="block text-sm font-medium text-gabriel-text mb-1">
            Email Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Exclusive offer just for you"
            className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Message <span className="text-gabriel-danger">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="Write your campaign message here. Use {{name}} to personalize."
          className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 resize-none"
        />
        <p className="text-xs text-gabriel-text-light mt-1">
          Tip: Use <code className="bg-gabriel-border/50 px-1 rounded">{"{{name}}"}</code> to insert the customer name.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Target Segments
        </label>
        <input
          type="text"
          value={segmentsRaw}
          onChange={(e) => setSegmentsRaw(e.target.value)}
          placeholder="e.g. vip, inactive-30d, newsletter (comma-separated)"
          className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
        />
        <p className="text-xs text-gabriel-text-light mt-1">
          Separate multiple segments with commas.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-1">
          Schedule Send (optional)
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
        />
        <p className="text-xs text-gabriel-text-light mt-1">
          Leave blank to save as draft and send manually.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gabriel-border text-sm font-medium text-gabriel-text hover:bg-gabriel-bg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-gabriel-primary text-white text-sm font-medium hover:bg-gabriel-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving..." : initial?.id ? "Save Changes" : "Create Campaign"}
        </button>
      </div>
    </form>
  );
}

// ==================== CAMPAIGN CARD ====================

interface CampaignCardProps {
  campaign: CampaignData;
  onEdit: (c: CampaignData) => void;
  onDelete: (c: CampaignData) => void;
  onStatusChange: (c: CampaignData, status: string) => void;
}

function CampaignCard({ campaign, onEdit, onDelete, onStatusChange }: CampaignCardProps) {
  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const channelCfg = CHANNEL_OPTIONS.find((c) => c.value === campaign.channel);
  const ChannelIcon = channelCfg?.icon ?? MessageSquare;

  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("p-2 rounded-lg flex-shrink-0", channelCfg?.color ?? "bg-gray-100 text-gray-600")}>
            <ChannelIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gabriel-text truncate">{campaign.name}</h3>
            {campaign.description && (
              <p className="text-xs text-gabriel-text-light mt-0.5 truncate">{campaign.description}</p>
            )}
          </div>
        </div>
        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", statusCfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {statusCfg.label}
        </span>
      </div>

      <div className="mt-4 text-sm text-gabriel-text-light line-clamp-2 leading-relaxed">
        {campaign.message}
      </div>

      {campaign.segments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campaign.segments.map((seg) => (
            <span key={seg} className="px-2 py-0.5 rounded-full bg-gabriel-primary-50 text-gabriel-primary text-xs font-medium">
              {seg}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gabriel-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gabriel-text-light">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {campaign.sentCount.toLocaleString()} sent
          </span>
          {campaign.scheduledAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(campaign.scheduledAt)}
            </span>
          )}
          {!campaign.scheduledAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(campaign.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {campaign.status === "draft" && (
            <button
              onClick={() => onStatusChange(campaign, "scheduled")}
              title="Mark as Scheduled"
              className="p-1.5 rounded-md text-gabriel-text-light hover:text-gabriel-primary hover:bg-gabriel-primary-50 transition-colors"
            >
              <Calendar className="h-4 w-4" />
            </button>
          )}
          {campaign.status === "running" && (
            <button
              onClick={() => onStatusChange(campaign, "paused")}
              title="Pause Campaign"
              className="p-1.5 rounded-md text-gabriel-text-light hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => onStatusChange(campaign, "running")}
              title="Resume Campaign"
              className="p-1.5 rounded-md text-gabriel-text-light hover:text-green-600 hover:bg-green-50 transition-colors"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(campaign)}
            title="Edit"
            className="p-1.5 rounded-md text-gabriel-text-light hover:text-gabriel-primary hover:bg-gabriel-primary-50 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(campaign)}
            title="Delete"
            className="p-1.5 rounded-md text-gabriel-text-light hover:text-gabriel-danger hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PAGE ====================

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignData | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CampaignData | null>(null);

  const fetchCampaigns = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "12",
        });
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (channelFilter !== "all") params.set("channel", channelFilter);

        const res = await fetch(`/api/campaigns?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.data ?? []);
          setPagination(data.pagination ?? { page: 1, limit: 12, total: 0, totalPages: 1 });
        }
      } catch {
        toast({ type: "error", title: "Failed to load campaigns" });
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, channelFilter, toast]
  );

  useEffect(() => {
    fetchCampaigns(1);
  }, [fetchCampaigns]);

  const handleSave = async (formData: Partial<CampaignData>) => {
    setSaving(true);
    try {
      const url = editingCampaign ? `/api/campaigns/${editingCampaign.id}` : "/api/campaigns";
      const method = editingCampaign ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
      toast({
        type: "success",
        title: editingCampaign ? "Campaign updated" : "Campaign created",
      });
      setModalOpen(false);
      setEditingCampaign(null);
      fetchCampaigns(pagination.page);
    } catch (err) {
      toast({ type: "error", title: String(err instanceof Error ? err.message : "Failed to save campaign") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/campaigns/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ type: "success", title: "Campaign deleted" });
      setDeleteTarget(null);
      fetchCampaigns(pagination.page);
    } catch {
      toast({ type: "error", title: "Failed to delete campaign" });
    }
  };

  const handleStatusChange = async (campaign: CampaignData, newStatus: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast({ type: "success", title: `Campaign ${newStatus}` });
      fetchCampaigns(pagination.page);
    } catch {
      toast({ type: "error", title: "Failed to update campaign status" });
    }
  };

  const filteredCampaigns = campaigns.filter((c) =>
    search === "" ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  const isFiltered = search !== "" || statusFilter !== "all" || channelFilter !== "all";

  // Summary counts
  const counts = {
    total: pagination.total,
    draft: campaigns.filter((c) => c.status === "draft").length,
    running: campaigns.filter((c) => c.status === "running").length,
    completed: campaigns.filter((c) => c.status === "completed").length,
  };

  return (
    <>
      <Header
        title="Campaigns"
        description="Create and manage outbound messaging campaigns"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Campaigns", value: counts.total, color: "bg-gabriel-primary-50 text-gabriel-primary" },
            { label: "Drafts", value: counts.draft, color: "bg-gray-100 text-gray-600" },
            { label: "Running", value: counts.running, color: "bg-green-50 text-green-600" },
            { label: "Completed", value: counts.completed, color: "bg-blue-50 text-blue-600" },
          ].map((item) => (
            <div key={item.label} className="bg-gabriel-surface rounded-xl border border-gabriel-border p-4">
              <p className="text-xs text-gabriel-text-light">{item.label}</p>
              <p className={cn("text-2xl font-bold mt-1", item.color.split(" ")[1])}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gabriel-text-light" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns..."
                className="pl-9 pr-3 py-2 rounded-lg border border-gabriel-border bg-gabriel-surface text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 w-52"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-gabriel-text-light" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gabriel-border bg-gabriel-surface text-sm text-gabriel-text focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gabriel-border bg-gabriel-surface text-sm text-gabriel-text focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
            >
              <option value="all">All Channels</option>
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => { setEditingCampaign(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gabriel-primary text-white text-sm font-medium hover:bg-gabriel-primary/90 transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>

        {/* Campaign grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gabriel-surface rounded-xl border border-gabriel-border p-5 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gabriel-border/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-gabriel-border/50" />
                    <div className="h-3 w-48 rounded bg-gabriel-border/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-gabriel-border/50" />
                  <div className="h-3 w-3/4 rounded bg-gabriel-border/50" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={(c) => { setEditingCampaign(c); setModalOpen(true); }}
                onDelete={(c) => setDeleteTarget(c)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gabriel-text-light">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCampaigns(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-gabriel-border text-gabriel-text-light hover:text-gabriel-text disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gabriel-text">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchCampaigns(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-gabriel-border text-gabriel-text-light hover:text-gabriel-text disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCampaign(null); }}
        title={editingCampaign ? "Edit Campaign" : "New Campaign"}
        size="lg"
      >
        <CampaignForm
          initial={editingCampaign ?? undefined}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditingCampaign(null); }}
          saving={saving}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
