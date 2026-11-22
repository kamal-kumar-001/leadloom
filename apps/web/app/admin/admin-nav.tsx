'use client';
import React from 'react';
import Link from 'next/link';
export function AdminNav(){return <nav className="flex items-center gap-4 text-xs font-medium"><Link href="/admin" className="text-brand-loom font-semibold border-b-2 border-brand-loom py-1">Platform overview</Link><span className="text-text-muted">Read-only metadata</span></nav>;}
