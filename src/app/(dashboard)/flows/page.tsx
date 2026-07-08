"use client";

import { Header } from "@/components/layout/header";
import {
  Workflow,
  Plus,
  Search,
  X,
  Edit3,
  Trash2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  HelpCircle,
  GitBranch,
  Zap,
  Bot,
  Users,
  Square,
  ArrowRight,
  GripVertical,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type {
  FlowNode,
  NodeType,
  FlowOption,
  FlowCondition,
  FlowAction,
} from "@/lib/flow-builder";
import { validateFlow } from "@/lib/flow-builder";

// ==================== TYPES ====================

interface FlowData {
  id: string;
  name: string;
  description: string;
  startNodeId: string;
  nodes: FlowNode[];
  isActive: boolean;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ==================== NODE CONFIG ====================

const NODE_TYPES: { type: NodeType; label: string; icon: React.ElementType; color: string; description: string }[] = [
  { type: "message", label: "Message", icon: MessageSquare, color: "bg-blue-50 text-blue-600 border-blue-200", description: "Send a message to the customer" },
  { type: "question", label: "Question", icon: HelpCircle, color: "bg-purple-50 text-purple-600 border-purple-200", description: "Ask a question with multiple choice options" },
  { type: "condition", label: "Condition", icon: GitBranch, color: "bg-amber-50 text-amber-600 border-amber-200", description: "Branch based on a condition" },
  { type: "action", label: "Action", icon: Zap, color: "bg-green-50 text-green-600 border-green-200", description: "Perform an action (create ticket, assign, tag)" },
  { type: "ai_response", label: "AI Response", icon: Bot, color: "bg-gabriel-primary-50 text-gabriel-primary border-gabriel-primary/20", description: "Let AI generate a response" },
  { type: "transfer", label: "Transfer", icon: Users, color: "bg-orange-50 text-orange-600 border-orange-200", description: "Transfer to a human agent" },
  { type: "end", label: "End", icon: Square, color: "bg-gray-100 text-gray-600 border-gray-200", description: "End the conversation flow" },
];

const CONDITION_FIELDS = [
  { value: "message_content", label: "Message Content" },
  { value: "channel", label: "Channel" },
  { value: "customer_name", label: "Customer Name" },
];

const CONDITION_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "starts_with", label: "Starts With" },
  { value: "not_contains", label: "Does Not Contain" },
];

const ACTION_TYPES = [
  { value: "create_ticket", label: "Create Ticket" },
  { value: "assign", label: "Assign to Team" },
  { value: "tag", label: "Add Tag" },
  { value: "send_email", label: "Send Email" },
  { value: "webhook", label: "Trigger Webhook" },
];

// ==================== HELPERS ====================

function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getNodeConfig(type: NodeType) {
  return NODE_TYPES.find((n) => n.type === type) ?? NODE_TYPES[0];
}

// ==================== NODE EDITOR ====================

interface NodeEditorProps {
  node: FlowNode;
  allNodes: FlowNode[];
  onChange: (updated: FlowNode) => void;
  onDelete: () => void;
  isStart: boolean;
  onSetStart: () => void;
}

function NodeEditor({ node, allNodes, onChange, onDelete, isStart, onSetStart }: NodeEditorProps) {
  const cfg = getNodeConfig(node.type);
  const NodeIcon = cfg.icon;
  const otherNodes = allNodes.filter((n) => n.id !== node.id);

  const updateContent = (content: string) => onChange({ ...node, content });
  const updateNextNodeId = (nextNodeId: string) => onChange({ ...node, nextNodeId: nextNodeId || undefined });

  const updateOption = (idx: number, field: keyof FlowOption, value: string) => {
    const options = [...(node.options ?? [])];
    options[idx] = { ...options[idx], [field]: value };
    onChange({ ...node, options });
  };

  const addOption = () => {
    const options = [...(node.options ?? []), { label: "", nextNodeId: "" }];
    onChange({ ...node, options });
  };

  const removeOption = (idx: number) => {
    const options = (node.options ?? []).filter((_, i) => i !== idx);
    onChange({ ...node, options });
  };

  const updateCondition = (field: keyof FlowCondition, value: string) => {
    const condition: FlowCondition = {
      field: node.condition?.field ?? "message_content",
      operator: node.condition?.operator ?? "contains",
      value: node.condition?.value ?? "",
      trueNodeId: node.condition?.trueNodeId ?? "",
      falseNodeId: node.condition?.falseNodeId ?? "",
      [field]: value,
    };
    onChange({ ...node, condition });
  };

  const updateAction = (field: keyof FlowAction | string, value: string) => {
    if (field === "type") {
      onChange({ ...node, action: { type: value, params: node.action?.params ?? {} } });
    } else {
      const params = { ...(node.action?.params ?? {}), [field]: value };
      onChange({ ...node, action: { type: node.action?.type ?? "create_ticket", params } });
    }
  };

  return (
    <div className={cn("rounded-xl border-2 p-4 space-y-3", cfg.color)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 opacity-40 cursor-grab" />
          <div className={cn("p-1.5 rounded-lg", cfg.color)}>
            <NodeIcon className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{cfg.label}</span>
          {isStart && (
            <span className="px-1.5 py-0.5 rounded-full bg-gabriel-primary text-white text-[10px] font-bold uppercase tracking-wide">
              Start
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isStart && (
            <button
              type="button"
              onClick={onSetStart}
              title="Set as start node"
              className="text-xs px-2 py-0.5 rounded border border-current opacity-60 hover:opacity-100 transition-opacity"
            >
              Set Start
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-gabriel-danger hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="text-xs text-gabriel-text-light font-mono bg-white/60 px-2 py-0.5 rounded w-fit">
        ID: {node.id}
      </div>

      {/* Content field (most node types) */}
      {node.type !== "condition" && (
        <div>
          <label className="block text-xs font-medium text-gabriel-text mb-1">
            {node.type === "transfer" ? "Transfer Message" : node.type === "end" ? "Closing Message (optional)" : "Message Content"}
          </label>
          <textarea
            value={node.content}
            onChange={(e) => updateContent(e.target.value)}
            rows={2}
            placeholder={node.type === "ai_response" ? "AI will generate a response here" : "Enter message..."}
            disabled={node.type === "ai_response"}
            className="w-full rounded-lg border border-gabriel-border bg-white px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 resize-none disabled:opacity-60"
          />
        </div>
      )}

      {/* Question options */}
      {node.type === "question" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gabriel-text">Answer Options</label>
            <button
              type="button"
              onClick={addOption}
              className="text-xs text-gabriel-primary hover:underline"
            >
              + Add option
            </button>
          </div>
          <div className="space-y-2">
            {(node.options ?? []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOption(idx, "label", e.target.value)}
                  placeholder="Option label"
                  className="flex-1 rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
                />
                <ArrowRight className="h-3.5 w-3.5 text-gabriel-text-light flex-shrink-0" />
                <select
                  value={opt.nextNodeId}
                  onChange={(e) => updateOption(idx, "nextNodeId", e.target.value)}
                  className="flex-1 rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
                >
                  <option value="">-- Select node --</option>
                  {otherNodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.id} ({getNodeConfig(n.type).label})</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeOption(idx)} className="text-gabriel-danger hover:opacity-80">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Condition */}
      {node.type === "condition" && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gabriel-text">Condition</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={node.condition?.field ?? "message_content"}
              onChange={(e) => updateCondition("field", e.target.value)}
              className="rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
            >
              {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select
              value={node.condition?.operator ?? "contains"}
              onChange={(e) => updateCondition("operator", e.target.value)}
              className="rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
            >
              {CONDITION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text"
              value={node.condition?.value ?? ""}
              onChange={(e) => updateCondition("value", e.target.value)}
              placeholder="Value"
              className="rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gabriel-text-light mb-1 block">If True</label>
              <select
                value={node.condition?.trueNodeId ?? ""}
                onChange={(e) => updateCondition("trueNodeId", e.target.value)}
                className="w-full rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
              >
                <option value="">-- Select node --</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.id} ({getNodeConfig(n.type).label})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gabriel-text-light mb-1 block">If False</label>
              <select
                value={node.condition?.falseNodeId ?? ""}
                onChange={(e) => updateCondition("falseNodeId", e.target.value)}
                className="w-full rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
              >
                <option value="">-- Select node --</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.id} ({getNodeConfig(n.type).label})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      {node.type === "action" && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gabriel-text">Action Type</label>
          <select
            value={node.action?.type ?? "create_ticket"}
            onChange={(e) => updateAction("type", e.target.value)}
            className="w-full rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
          >
            {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input
            type="text"
            value={node.action?.params?.value ?? ""}
            onChange={(e) => updateAction("value", e.target.value)}
            placeholder="Parameter value (e.g. department name, tag name)"
            className="w-full rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
          />
        </div>
      )}

      {/* Next node (for non-branching types) */}
      {!["condition", "question", "end", "transfer"].includes(node.type) && (
        <div>
          <label className="block text-xs font-medium text-gabriel-text mb-1">Next Node</label>
          <select
            value={node.nextNodeId ?? ""}
            onChange={(e) => updateNextNodeId(e.target.value)}
            className="w-full rounded-lg border border-gabriel-border bg-white px-2 py-1.5 text-xs text-gabriel-text focus:outline-none focus:ring-1 focus:ring-gabriel-primary/30"
          >
            <option value="">-- End flow --</option>
            {otherNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.id} ({getNodeConfig(n.type).label})</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ==================== FLOW EDITOR MODAL ====================

interface FlowEditorProps {
  initial?: Partial<FlowData>;
  onSave: (data: Partial<FlowData>) => void;
  onCancel: () => void;
  saving: boolean;
}

function FlowEditor({ initial, onSave, onCancel, saving }: FlowEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startNodeId, setStartNodeId] = useState(initial?.startNodeId ?? "");
  const [nodes, setNodes] = useState<FlowNode[]>((initial?.nodes as FlowNode[]) ?? []);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addNode = (type: NodeType) => {
    const id = generateId();
    const newNode: FlowNode = { id, type, content: "" };
    if (type === "condition") {
      newNode.condition = { field: "message_content", operator: "contains", value: "", trueNodeId: "", falseNodeId: "" };
    }
    if (type === "action") {
      newNode.action = { type: "create_ticket", params: {} };
    }
    const updated = [...nodes, newNode];
    setNodes(updated);
    if (!startNodeId) setStartNodeId(id);
  };

  const updateNode = (idx: number, updated: FlowNode) => {
    const next = [...nodes];
    next[idx] = updated;
    setNodes(next);
  };

  const deleteNode = (idx: number) => {
    const deletedId = nodes[idx].id;
    const next = nodes.filter((_, i) => i !== idx);
    setNodes(next);
    if (startNodeId === deletedId) {
      setStartNodeId(next[0]?.id ?? "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const flowDef = { id: initial?.id ?? "preview", name, description, startNodeId, nodes, isActive: initial?.isActive ?? false };
    const { errors } = validateFlow(flowDef);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    onSave({ name: name.trim(), description: description.trim(), startNodeId, nodes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gabriel-text mb-1">
            Flow Name <span className="text-gabriel-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Support Intake"
            className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gabriel-text mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-lg border border-gabriel-border bg-gabriel-bg px-3 py-2 text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30"
          />
        </div>
      </div>

      {/* Add node buttons */}
      <div>
        <label className="block text-sm font-medium text-gabriel-text mb-2">Add Node</label>
        <div className="flex flex-wrap gap-2">
          {NODE_TYPES.map((nt) => (
            <button
              key={nt.type}
              type="button"
              onClick={() => addNode(nt.type)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80",
                nt.color
              )}
            >
              <nt.icon className="h-3.5 w-3.5" />
              {nt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Node list */}
      {nodes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gabriel-border p-8 text-center">
          <Workflow className="h-8 w-8 mx-auto text-gabriel-text-light mb-2 opacity-40" />
          <p className="text-sm text-gabriel-text-light">Add nodes above to build your flow</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {nodes.map((node, idx) => (
            <NodeEditor
              key={node.id}
              node={node}
              allNodes={nodes}
              onChange={(updated) => updateNode(idx, updated)}
              onDelete={() => deleteNode(idx)}
              isStart={node.id === startNodeId}
              onSetStart={() => setStartNodeId(node.id)}
            />
          ))}
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
          <div className="flex items-center gap-2 text-gabriel-danger text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Flow validation failed
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-xs text-red-700">{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gabriel-border">
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gabriel-primary text-white text-sm font-medium hover:bg-gabriel-primary/90 disabled:opacity-60 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : initial?.id ? "Save Flow" : "Create Flow"}
        </button>
      </div>
    </form>
  );
}

// ==================== FLOW CARD ====================

interface FlowCardProps {
  flow: FlowData;
  onEdit: (f: FlowData) => void;
  onDelete: (f: FlowData) => void;
  onToggle: (f: FlowData) => void;
}

function FlowCard({ flow, onEdit, onDelete, onToggle }: FlowCardProps) {
  const nodes = (flow.nodes as FlowNode[]) ?? [];
  const nodeTypeCounts: Partial<Record<NodeType, number>> = {};
  nodes.forEach((n) => {
    nodeTypeCounts[n.type] = (nodeTypeCounts[n.type] ?? 0) + 1;
  });

  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-gabriel-primary-50 text-gabriel-primary flex-shrink-0">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gabriel-text truncate">{flow.name}</h3>
            {flow.description && (
              <p className="text-xs text-gabriel-text-light mt-0.5 truncate">{flow.description}</p>
            )}
          </div>
        </div>
        <span className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
          flow.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
        )}>
          {flow.isActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {flow.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Node type breakdown */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {Object.entries(nodeTypeCounts).map(([type, count]) => {
          const cfg = getNodeConfig(type as NodeType);
          const Icon = cfg.icon;
          return (
            <span key={type} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.color)}>
              <Icon className="h-3 w-3" />
              {count} {cfg.label}
            </span>
          );
        })}
        {nodes.length === 0 && (
          <span className="text-xs text-gabriel-text-light italic">No nodes yet</span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gabriel-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gabriel-text-light">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {flow.triggerCount.toLocaleString()} triggers
          </span>
          <span>{nodes.length} nodes</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(flow)}
            title={flow.isActive ? "Deactivate" : "Activate"}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              flow.isActive
                ? "text-gabriel-text-light hover:text-amber-600 hover:bg-amber-50"
                : "text-gabriel-text-light hover:text-green-600 hover:bg-green-50"
            )}
          >
            {flow.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(flow)}
            title="Edit"
            className="p-1.5 rounded-md text-gabriel-text-light hover:text-gabriel-primary hover:bg-gabriel-primary-50 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(flow)}
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

export default function FlowsPage() {
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowData | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FlowData | null>(null);

  const fetchFlows = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "12" });
        if (activeFilter === "active") params.set("isActive", "true");
        if (activeFilter === "inactive") params.set("isActive", "false");

        const res = await fetch(`/api/flows?${params}`);
        if (res.ok) {
          const data = await res.json();
          setFlows(data.data ?? []);
          setPagination(data.pagination ?? { page: 1, limit: 12, total: 0, totalPages: 1 });
        }
      } catch {
        toast({ type: "error", title: "Failed to load flows" });
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, toast]
  );

  useEffect(() => {
    fetchFlows(1);
  }, [fetchFlows]);

  const handleSave = async (formData: Partial<FlowData>) => {
    setSaving(true);
    try {
      const url = editingFlow ? `/api/flows/${editingFlow.id}` : "/api/flows";
      const method = editingFlow ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
      toast({ type: "success", title: editingFlow ? "Flow updated" : "Flow created" });
      setModalOpen(false);
      setEditingFlow(null);
      fetchFlows(pagination.page);
    } catch (err) {
      toast({ type: "error", title: String(err instanceof Error ? err.message : "Failed to save flow") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/flows/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ type: "success", title: "Flow deleted" });
      setDeleteTarget(null);
      fetchFlows(pagination.page);
    } catch {
      toast({ type: "error", title: "Failed to delete flow" });
    }
  };

  const handleToggle = async (flow: FlowData) => {
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !flow.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ type: "success", title: flow.isActive ? "Flow deactivated" : "Flow activated" });
      fetchFlows(pagination.page);
    } catch {
      toast({ type: "error", title: "Failed to toggle flow" });
    }
  };

  const filteredFlows = flows.filter(
    (f) =>
      search === "" ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase())
  );

  const isFiltered = search !== "" || activeFilter !== "all";
  const activeCount = flows.filter((f) => f.isActive).length;

  return (
    <>
      <Header
        title="Flow Builder"
        description="Design automated conversation flows for your AI agent"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Flows", value: pagination.total, color: "text-gabriel-primary" },
            { label: "Active", value: activeCount, color: "text-green-600" },
            { label: "Inactive", value: pagination.total - activeCount, color: "text-gray-500" },
            { label: "Total Triggers", value: flows.reduce((s, f) => s + f.triggerCount, 0).toLocaleString(), color: "text-blue-600" },
          ].map((item) => (
            <div key={item.label} className="bg-gabriel-surface rounded-xl border border-gabriel-border p-4">
              <p className="text-xs text-gabriel-text-light">{item.label}</p>
              <p className={cn("text-2xl font-bold mt-1", item.color)}>{item.value}</p>
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
                placeholder="Search flows..."
                className="pl-9 pr-3 py-2 rounded-lg border border-gabriel-border bg-gabriel-surface text-sm text-gabriel-text placeholder:text-gabriel-text-light focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 w-52"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-gabriel-text-light" />
                </button>
              )}
            </div>

            <div className="flex bg-gabriel-surface border border-gabriel-border rounded-lg p-0.5">
              {(["all", "active", "inactive"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setActiveFilter(opt)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                    activeFilter === opt
                      ? "bg-gabriel-primary text-white"
                      : "text-gabriel-text-light hover:text-gabriel-text"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setEditingFlow(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gabriel-primary text-white text-sm font-medium hover:bg-gabriel-primary/90 transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Flow
          </button>
        </div>

        {/* Flow grid */}
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
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-6 w-16 rounded-full bg-gabriel-border/50" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-gabriel-primary-50 mb-4">
              <Workflow className="h-8 w-8 text-gabriel-primary" />
            </div>
            <p className="font-semibold text-gabriel-text">
              {isFiltered ? "No flows match your filters" : "No flows yet"}
            </p>
            <p className="text-sm text-gabriel-text-light mt-1 max-w-xs">
              {isFiltered
                ? "Try adjusting your search or filter."
                : "Build your first conversation flow to automate how your AI agent handles customer interactions."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFlows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onEdit={(f) => { setEditingFlow(f); setModalOpen(true); }}
                onDelete={(f) => setDeleteTarget(f)}
                onToggle={handleToggle}
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
                onClick={() => fetchFlows(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-gabriel-border text-gabriel-text-light hover:text-gabriel-text disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gabriel-text">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchFlows(pagination.page + 1)}
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
        onClose={() => { setModalOpen(false); setEditingFlow(null); }}
        title={editingFlow ? `Edit Flow: ${editingFlow.name}` : "New Flow"}
        size="lg"
      >
        <FlowEditor
          initial={editingFlow ?? undefined}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditingFlow(null); }}
          saving={saving}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Flow"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
