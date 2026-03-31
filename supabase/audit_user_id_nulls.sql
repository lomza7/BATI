select 'clients' as table_name, count(*) as orphan_rows from clients where user_id is null
union all
select 'quotes', count(*) from quotes where user_id is null
union all
select 'quote_lines', count(*) from quote_lines where user_id is null
union all
select 'invoices', count(*) from invoices where user_id is null
union all
select 'invoice_lines', count(*) from invoice_lines where user_id is null
union all
select 'projects', count(*) from projects where user_id is null
union all
select 'project_photos', count(*) from project_photos where user_id is null
union all
select 'team_members', count(*) from team_members where user_id is null
union all
select 'planning_events', count(*) from planning_events where user_id is null
union all
select 'leads', count(*) from leads where user_id is null
union all
select 'reviews', count(*) from reviews where user_id is null
union all
select 'ai_agents', count(*) from ai_agents where user_id is null
union all
select 'ai_conversations', count(*) from ai_conversations where user_id is null
union all
select 'ai_messages', count(*) from ai_messages where user_id is null
union all
select 'recurring_contracts', count(*) from recurring_contracts where user_id is null
union all
select 'expenses', count(*) from expenses where user_id is null
union all
select 'team_notes', count(*) from team_notes where user_id is null
union all
select 'team_assignments', count(*) from team_assignments where user_id is null
order by orphan_rows desc, table_name;
