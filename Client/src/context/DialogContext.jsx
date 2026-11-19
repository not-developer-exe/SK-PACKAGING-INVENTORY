import React, { createContext, useCallback, useContext, useState } from 'react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const [resolver, setResolver] = useState(null);
  const [notice, setNotice] = useState(null);
  const open = useCallback((config) => new Promise((resolve) => { setValue(config.defaultValue || ''); setResolver(() => resolve); setDialog(config); }), []);
  const close = useCallback((result) => { setDialog(null); setValue(''); resolver?.(result); setResolver(null); }, [resolver]);
  const confirm = useCallback((config) => open({ kind: 'confirm', title: config.title || 'Please confirm', message: config.message || '', confirmLabel: config.confirmLabel || 'Confirm', destructive: Boolean(config.destructive) }), [open]);
  const prompt = useCallback((config) => open({ kind: 'prompt', title: config.title || 'Enter details', message: config.message || '', confirmLabel: config.confirmLabel || 'Continue', placeholder: config.placeholder || '', minLength: config.minLength || 0, destructive: Boolean(config.destructive) }), [open]);
  const alert = useCallback((config) => open({ kind: 'alert', title: config.title || 'Notice', message: typeof config === 'string' ? config : (config.message || ''), confirmLabel: 'Okay' }), [open]);
  const notify = useCallback((message, type = 'success') => { setNotice({ message, type }); window.setTimeout(() => setNotice(null), 3200); }, []);
  const invalid = dialog?.kind === 'prompt' && (!value.trim() || value.trim().length < dialog.minLength);
  return <DialogContext.Provider value={{ confirm, prompt, alert, notify }}>{children}
    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"><section role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><h2 id="app-dialog-title" className="text-lg font-semibold text-slate-900">{dialog.title}</h2>{dialog.message && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{dialog.message}</p>}{dialog.kind === 'prompt' && <textarea autoFocus rows={4} value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />}<div className="mt-6 flex justify-end gap-2">{dialog.kind !== 'alert' && <button type="button" onClick={() => close(dialog.kind === 'prompt' ? null : false)} className="rounded-xl border px-4 py-2 text-sm">Go back</button>}<button type="button" disabled={invalid} onClick={() => close(dialog.kind === 'prompt' ? value.trim() : true)} className={'rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ' + (dialog.destructive ? 'bg-red-600' : 'bg-blue-600')}>{dialog.confirmLabel}</button></div></section></div>}
    {notice && <div role="status" className="fixed right-5 top-5 z-[110] rounded-xl border bg-white px-4 py-3 text-sm shadow-lg">{notice.message}</div>}
  </DialogContext.Provider>;
}

export function useDialogs() { const context = useContext(DialogContext); if (!context) throw new Error('useDialogs must be used inside DialogProvider'); return context; }
