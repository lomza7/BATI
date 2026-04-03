'use client';

import { useState } from 'react';
import { Trash2, GripVertical, CalendarDays, Pencil, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TODO_PRIORITIES, TODO_CATEGORIES, type Todo } from '@/lib/todo-constants';
import { formatDate } from '@/lib/constants';
import { Button } from '@/components/ui/button';

interface TodoCardProps {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
}

export function TodoCard({ todo, onToggle, onDelete, onEdit }: TodoCardProps) {
  const [checking, setChecking] = useState(false);
  const priority = TODO_PRIORITIES[todo.priority] || TODO_PRIORITIES.moyenne;
  const category = TODO_CATEGORIES[todo.category] || TODO_CATEGORIES.autre;

  const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date(new Date().toDateString());

  function handleToggle() {
    setChecking(true);
    setTimeout(() => {
      onToggle(todo.id, !todo.completed);
      setChecking(false);
    }, 300);
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border bg-card p-4 transition-all duration-200',
        todo.completed
          ? 'border-border/50 bg-muted/30'
          : 'border-border hover:shadow-md hover:border-border/80',
        checking && 'scale-[0.98] opacity-70'
      )}
    >
      <div className="hidden sm:flex pt-0.5 text-muted-foreground/40 cursor-grab">
        <GripVertical className="h-4 w-4" />
      </div>

      <button
        onClick={handleToggle}
        className={cn(
          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
          todo.completed
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-muted-foreground/30 hover:border-primary'
        )}
      >
        {todo.completed && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm font-medium transition-all',
            todo.completed ? 'text-muted-foreground line-through' : 'text-foreground'
          )}>
            {todo.title}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(todo)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(todo.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {todo.description && (
          <p className={cn(
            'mt-0.5 text-xs',
            todo.completed ? 'text-muted-foreground/60' : 'text-muted-foreground'
          )}>
            {todo.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', priority.color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} />
            {priority.label}
          </span>

          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', category.color)}>
            {category.label}
          </span>

          {todo.client_name && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600">
              <User className="h-3 w-3" />
              {todo.client_name}
            </span>
          )}

          {todo.due_date && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium',
              isOverdue ? 'text-red-600' : 'text-muted-foreground'
            )}>
              <CalendarDays className="h-3 w-3" />
              {formatDate(todo.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
