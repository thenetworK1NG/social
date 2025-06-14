-- Create a table for public profiles
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    user_name text,
    created_at timestamp with time zone default now()
);

-- Drop existing policies if they exist
drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "Users can insert their own posts" on public.posts;

-- Create the posts table with proper foreign key relationship
create table if not exists public.posts (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    image_url text not null,
    caption text,
    constraint fk_user
        foreign key (user_id)
        references auth.users(id)
        on delete cascade
);

-- Enable RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.posts enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone" 
on public.profiles for select 
using (true);

create policy "Users can insert their own profile" 
on public.profiles for insert 
with check (auth.uid() = id);

create policy "Users can update their own profile" 
on public.profiles for update 
using (auth.uid() = id);

-- Create policies for posts
create policy "Posts are viewable by everyone"
on public.posts for select
to public
using (true);

create policy "Users can insert their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id);

-- Create a function to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, user_name)
    values (new.id, new.raw_user_meta_data->>'user_name');
    return new;
end;
$$;

-- Create a trigger to call the function when a user is created
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Create a storage bucket for posts
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files to the posts bucket
create policy "Allow authenticated users to upload files"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'posts' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to read files
create policy "Allow public to read files"
on storage.objects for select
to public
using ( bucket_id = 'posts' );

-- Create view to join posts with profiles
create or replace view public.posts_with_profiles as
select 
    p.*,
    pr.user_name
from 
    public.posts p
    left join public.profiles pr on p.user_id = pr.id;

-- Grant access to the view
grant select on public.posts_with_profiles to anon, authenticated; 