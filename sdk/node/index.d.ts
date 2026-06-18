declare class ARIA {
  constructor(opts?: { base?: string; timeoutMs?: number });
  captureLead(p: { name: string; email: string; company?: string; phone?: string; message?: string; source?: string; last_intent?: string }): Promise<any>;
  requestHandoff(p: { email: string; name?: string; chat_summary?: string; last_intent?: string; urgency?: 'normal' | 'urgent' }): Promise<any>;
  exportMyData(p: { email: string }): Promise<any>;
  deleteMyAccount(p: { email: string; confirm: 'DELETE-MY-DATA' }): Promise<any>;
  changePlan(p: { email: string; new_tier: 'personal' | 'pro' | 'small_business' | 'mid_size' | 'enterprise' }): Promise<any>;
  m365Graph(p: { action: 'health-check' | 'list-users' | 'get-user' | 'check-license' | 'list-groups' | 'list-devices'; params?: any }): Promise<any>;
  requestMagicLink(email: string): Promise<any>;
  verifyMagicLink(token: string): Promise<any>;
  feedback(p: { vote: 'up' | 'down'; msg_id?: string; text?: string; intent?: string; comment?: string; email?: string }): Promise<any>;
  mrr(): Promise<any>;
  costStatus(): Promise<any>;
  costLog(p: { tokens_in?: number; tokens_out?: number; model?: string; customer_id?: string }): Promise<any>;
  submitTenantKB(p: { tenant_email: string; kb_content: string; kb_title?: string; contact_name?: string }): Promise<any>;
  renewalScan(dryRun?: boolean): Promise<any>;
}
export = ARIA;
