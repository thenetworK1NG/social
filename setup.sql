-- Clean up any existing objects
DROP VIEW IF EXISTS posts_with_profiles CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    user_name TEXT UNIQUE NOT NULL CHECK (char_length(user_name) >= 3 AND char_length(user_name) <= 20 AND user_name ~ '^[a-zA-Z0-9_]+$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT username_length CHECK (char_length(user_name) >= 3 AND char_length(user_name) <= 20)
);

-- Create posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT CHECK (char_length(caption) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create view for posts with user info
CREATE VIEW posts_with_profiles AS
SELECT 
    p.id,
    p.image_url,
    p.caption,
    p.created_at,
    p.user_id,
    pr.user_name
FROM posts p
JOIN profiles pr ON p.user_id = pr.id;

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Posts policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

CREATE POLICY "Posts are viewable by everyone" 
ON posts FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own posts" 
ON posts FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" 
ON posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" 
ON posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Set up storage
DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Posts images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a post image" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own post image" ON storage.objects;

INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Post images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Anyone can upload a post image" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts');
CREATE POLICY "Anyone can update their own post image" ON storage.objects FOR UPDATE USING (bucket_id = 'posts');

-- Function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, user_name)
  VALUES (new.id, 'User' || substr(md5(new.id::text), 1, 8))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 