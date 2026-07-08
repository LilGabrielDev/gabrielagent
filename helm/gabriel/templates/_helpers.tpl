{{/*
Expand the name of the chart.
*/}}
{{- define "gabriel.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "gabriel.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "gabriel.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "gabriel.labels" -}}
helm.sh/chart: {{ include "gabriel.chart" . }}
{{ include "gabriel.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "gabriel.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gabriel.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service account name
*/}}
{{- define "gabriel.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "gabriel.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database URL - construct from individual fields or use provided URL
*/}}
{{- define "gabriel.databaseUrl" -}}
{{- if .Values.database.url }}
{{- .Values.database.url }}
{{- else }}
{{- printf "postgresql://%s:%s@%s:%d/%s?schema=public&sslmode=%s" .Values.database.user .Values.database.password .Values.database.host (int .Values.database.port) .Values.database.name .Values.database.sslMode }}
{{- end }}
{{- end }}

{{/*
Secret name - use existing or generate
*/}}
{{- define "gabriel.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "gabriel.fullname" . }}
{{- end }}
{{- end }}
