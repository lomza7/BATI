-- Perf : index sur les 27 clés étrangères non couvertes (advisor unindexed_foreign_keys).
-- Accélère jointures et cascades — notamment quote_lines/invoice_lines lus à chaque
-- aperçu de devis/facture. Appliquée en prod le 2026-08-03.
create index if not exists idx_agent_documents_agent_id on agent_documents(agent_id);
create index if not exists idx_agent_documents_uploaded_by on agent_documents(uploaded_by);
create index if not exists idx_ai_conversations_agent_id on ai_conversations(agent_id);
create index if not exists idx_ai_messages_conversation_id on ai_messages(conversation_id);
create index if not exists idx_bank_transactions_matched_expense_id on bank_transactions(matched_expense_id);
create index if not exists idx_bank_transactions_matched_invoice_id on bank_transactions(matched_invoice_id);
create index if not exists idx_calendar_events_client_id on calendar_events(client_id);
create index if not exists idx_catalog_client_selections_product_id on catalog_client_selections(product_id);
create index if not exists idx_contract_invoices_invoice_id on contract_invoices(invoice_id);
create index if not exists idx_document_files_folder_id on document_files(folder_id);
create index if not exists idx_document_folders_parent_id on document_folders(parent_id);
create index if not exists idx_expenses_expense_category_id on expenses(expense_category_id);
create index if not exists idx_invoice_lines_invoice_id on invoice_lines(invoice_id);
create index if not exists idx_invoice_reminder_log_user_id on invoice_reminder_log(user_id);
create index if not exists idx_invoice_sends_invoice_id on invoice_sends(invoice_id);
create index if not exists idx_invoice_sends_user_id on invoice_sends(user_id);
create index if not exists idx_invoices_recurring_contract_id on invoices(recurring_contract_id);
create index if not exists idx_planning_events_project_id on planning_events(project_id);
create index if not exists idx_planning_events_team_member_id on planning_events(team_member_id);
create index if not exists idx_projects_client_id on projects(client_id);
create index if not exists idx_quote_lines_quote_id on quote_lines(quote_id);
create index if not exists idx_recurring_contracts_client_id on recurring_contracts(client_id);
create index if not exists idx_referral_invites_signed_up_user_id on referral_invites(signed_up_user_id);
create index if not exists idx_reviews_project_id on reviews(project_id);
create index if not exists idx_support_tickets_handled_by on support_tickets(handled_by);
create index if not exists idx_team_notes_team_member_id on team_notes(team_member_id);
create index if not exists idx_workspace_memberships_invited_by on workspace_memberships(invited_by);
