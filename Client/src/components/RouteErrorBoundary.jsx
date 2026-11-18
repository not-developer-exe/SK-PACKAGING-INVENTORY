import React from 'react';

const MODULE_NAMES = {
  '/sales': 'Sales Invoices',
  '/sales/new': 'Create GST Invoice',
  '/inventory/inward': 'Stock Inward',
  '/admin/products': 'Product Specifications',
  '/operations/production-intelligence': 'Production Planning & Reports',
  '/operations/conversion': 'Conversion',
  '/operations/dispatch': 'Box Dispatch'
};

export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERP ROUTE ERROR]', {
      route: this.props.pathname,
      module: this.props.moduleName,
      error,
      componentStack: errorInfo?.componentStack
    });
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const moduleName = this.props.moduleName || MODULE_NAMES[this.props.pathname] || 'This module';
    const isDevelopment = import.meta.env?.DEV;

    return (
      <section role="alert" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700" aria-hidden="true">!</div>
        <h1 className="text-xl font-semibold text-slate-900">{moduleName} could not be displayed</h1>
        <p className="mt-2 text-sm text-slate-600">A page error occurred. Your saved records have not been changed by this display error. You can retry this page or return to the dashboard.</p>
        {isDevelopment && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-red-700">{String(error?.message || error)}</pre>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={this.retry} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Retry module</button>
          <a href="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to dashboard</a>
        </div>
      </section>
    );
  }
}
