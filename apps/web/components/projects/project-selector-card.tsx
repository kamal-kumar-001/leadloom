'use client';

import React, { useState } from 'react';
import { Card, Button, Badge, EmptyState } from '@leadloom/ui';
import { FolderGit2, Plus, Check, Calendar, Hash, X } from 'lucide-react';
import { FormField } from '../feedback/form-field';
import { notify } from '../../lib/notify';
import { createWorkspaceProject } from '../../lib/engine-client';
import { CreateProjectRequestSchema } from '@leadloom/contracts';
import type { ProjectResponse } from '@leadloom/contracts';

export interface ProjectSelectorCardProps {
  projects: ProjectResponse[];
  selectedProject: ProjectResponse | null;
  onSelectProject: (project: ProjectResponse | null) => void;
  onProjectCreated: (newProject: ProjectResponse) => void;
  isLoading?: boolean;
}

export function ProjectSelectorCard({
  projects,
  selectedProject,
  onSelectProject,
  onProjectCreated,
  isLoading = false,
}: ProjectSelectorCardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string; description?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim() || undefined;
    const trimmedDesc = description.trim() || undefined;

    const payload = {
      name: trimmedName,
      slug: trimmedSlug,
      description: trimmedDesc,
    };

    const parseResult = CreateProjectRequestSchema.safeParse(payload);
    if (!parseResult.success) {
      const errors: { name?: string; slug?: string; description?: string } = {};
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0] as 'name' | 'slug' | 'description';
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await createWorkspaceProject(parseResult.data);
      if (res.error || !res.project) {
        notify.error(res.error || 'Failed to create project');
        return;
      }

      notify.success(`Project "${res.project.name}" created successfully`);
      setName('');
      setSlug('');
      setDescription('');
      setIsCreating(false);
      onProjectCreated(res.project);
      onSelectProject(res.project);
    } catch (err: unknown) {
      notify.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-brand-loom" />
            <span>Workspace Projects</span>
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Select a project to filter agent tokens and configure environment credentials.
          </p>
        </div>

        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => {
            setIsCreating(!isCreating);
            setFieldErrors({});
          }}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          {isCreating ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </>
          )}
        </Button>
      </div>

      {/* Inline Create Project Form */}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl bg-canvas-elevated border border-border-subtle space-y-4 transition-all"
        >
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Register New Project
            </h3>
            <span className="text-[11px] text-text-muted">Workspace-scoped registry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="new-project-name"
              label="Project Name"
              required
              hint="Human-readable title (e.g. Enterprise Outreach Q4)"
              error={fieldErrors.name}
            >
              <input
                id="new-project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enterprise Outreach Q4"
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
              />
            </FormField>

            <FormField
              id="new-project-slug"
              label="Project Slug (Optional)"
              hint="Unique identifier (e.g. enterprise-q4). Must not be formatted as a UUID."
              error={fieldErrors.slug}
            >
              <input
                id="new-project-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="enterprise-q4"
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
              />
            </FormField>
          </div>

          <FormField
            id="new-project-desc"
            label="Description (Optional)"
            hint="Brief summary of the project goals or team assignment"
            error={fieldErrors.description}
          >
            <input
              id="new-project-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outbound lead pipeline for enterprise segment"
              disabled={isSubmitting}
              className="w-full px-3 py-1.5 text-xs bg-canvas border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-loom"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreating(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="text-xs"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      )}

      {/* Project Selector Pills / List */}
      {isLoading ? (
        <div className="py-6 text-center text-xs text-text-muted">
          Loading workspace projects...
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects registered yet"
          description="Create your first workspace-owned project to issue project-scoped agent tokens and manage context."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Project</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {/* All Projects button */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border ${
                selectedProject === null
                  ? 'bg-brand-loom/15 text-brand-loom border-brand-loom/40 shadow-sm'
                  : 'bg-canvas-elevated text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-muted'
              }`}
            >
              All Projects ({projects.length})
            </button>

            {projects.map((proj) => {
              const isSelected = selectedProject?.id === proj.id;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => onSelectProject(proj)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-brand-loom/15 text-brand-loom border-brand-loom/40 shadow-sm'
                      : 'bg-canvas-elevated text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-muted'
                  }`}
                >
                  <span>{proj.name}</span>
                  <Badge variant="muted" className="text-[10px] font-mono px-1 py-0">
                    {proj.slug}
                  </Badge>
                  {isSelected && <Check className="w-3 h-3 text-brand-loom shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Active Project Detail Pill / Banner */}
          {selectedProject && (
            <div className="mt-3 p-3 rounded-lg bg-canvas-elevated border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{selectedProject.name}</span>
                  <Badge variant="muted" className="text-[10px] font-mono">
                    slug: {selectedProject.slug}
                  </Badge>
                </div>
                {selectedProject.description && (
                  <p className="text-text-secondary text-[11px]">{selectedProject.description}</p>
                )}
              </div>

              <div className="flex items-center gap-3 text-text-muted text-[11px] shrink-0 font-mono">
                <div className="flex items-center gap-1" title="Canonical Project UUID">
                  <Hash className="w-3 h-3" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{selectedProject.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(selectedProject.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
