-- Create a profiles table
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamp with time zone,
    user_name text unique not null,
    constraint username_length check (char_length(user_name) >= 3 and char_length(user_name) <= 20),
    constraint username_format check (user_name ~ '^[a-zA-Z0-9_]+$')
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone"
on public.profiles for select
to public
using (true);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, user_name, updated_at)
    values (new.id, 'user_' || substr(new.id::text, 1, 8), now());
    return new;
end;
$$;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Create posts table with proper foreign key relationship
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

-- Enable RLS
alter table public.posts enable row level security;

-- Create policies
create policy "Posts are viewable by everyone"
on public.posts for select
to public
using (true);

create policy "Users can insert their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using (auth.uid() = user_id);

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