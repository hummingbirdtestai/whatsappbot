-- MCQ Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- MCQs
create table if not exists mcqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null, -- e.g. { "a": "...", "b": "...", ... }
  answer text not null,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_mcqs_category_id on mcqs(category_id);

-- Quiz Funnels
create table if not exists quiz_funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scheduled_at timestamptz not null,
  status text check (status in ('scheduled', 'active', 'completed', 'cancelled')) default 'scheduled',
  created_at timestamptz default now()
);

-- Quiz Funnel MCQs
create table if not exists quiz_funnel_mcqs (
  id uuid primary key default gen_random_uuid(),
  quiz_funnel_id uuid references quiz_funnels(id) on delete cascade,
  mcq_id uuid references mcqs(id) on delete cascade,
  order_index int not null, -- 1 to 300
  unique (quiz_funnel_id, mcq_id)
);
create index if not exists idx_quiz_funnel_mcqs_funnel_id on quiz_funnel_mcqs(quiz_funnel_id);

-- Mock Tests
create table if not exists mock_tests (
  id uuid primary key default gen_random_uuid(),
  quiz_funnel_id uuid references quiz_funnels(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  status text check (status in ('active', 'completed', 'running')) default 'active',
  current_mcq int default 0, -- Track progress: number of MCQs published
  created_at timestamptz default now()
);
create index if not exists idx_mock_tests_status on mock_tests(status);

-- WhatsApp Groups
create table if not exists whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  jid text unique not null,
  name text,
  created_at timestamptz default now()
);

-- View for category MCQ counts
create or replace view category_mcq_counts as
select c.id, c.name, count(m.id) as mcq_count
from categories c
left join mcqs m on m.category_id = c.id
group by c.id, c.name;