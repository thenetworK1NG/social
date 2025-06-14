-- Create a table for public profiles
create table profiles (
    id uuid references auth.users on delete cascade not null primary key,
    user_name text,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone" on profiles
    for select using (true);

create policy "Users can update their own profile" on profiles
    for update using (auth.uid() = id);

-- Create a trigger to automatically create a profile for new users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.profiles (id, user_name)
    values (new.id, new.raw_user_meta_data->>'user_name');
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user(); 