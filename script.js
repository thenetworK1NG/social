// Initialize Supabase client
const supabaseUrl = 'https://tjjnkcwtuxpwictlkkit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqam5rY3d0dXhwd2ljdGxra2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4ODEwNjIsImV4cCI6MjA2NTQ1NzA2Mn0.NvfJjt27Dj4lqFBD-UVdEDY4up0NM3K6yqA9JecsYdQ'; // Replace with your actual anon key
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// DOM Elements
const postForm = document.getElementById('postForm');
const postsContainer = document.getElementById('postsContainer');
const imageInput = document.getElementById('imageInput');
const captionInput = document.getElementById('caption');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn = document.getElementById('auth-logged-in');
const userEmail = document.getElementById('userEmail');
const postFormSection = document.getElementById('postFormSection');
const usernameForm = document.getElementById('usernameForm');
const usernameInput = document.getElementById('usernameInput');
const usernameDisplay = document.getElementById('usernameDisplay');

// Check initial auth state
checkAuthState();

// Auth state handler
async function checkAuthState() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (user) {
        await showLoggedInState(user);
    } else {
        showLoggedOutState();
    }
}

// Generate a random username
function generateTempUsername() {
    const adjectives = ['Happy', 'Creative', 'Vibrant', 'Peaceful', 'Energetic', 'Gentle', 'Bright', 'Calm'];
    const nouns = ['Vibe', 'Wave', 'Soul', 'Spirit', 'Heart', 'Mind', 'Star', 'Light'];
    const randomNum = Math.floor(Math.random() * 10000);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}${randomNum}`;
}

// Show logged in state
async function showLoggedInState(user) {
    try {
        authLoggedOut.style.display = 'none';
        authLoggedIn.style.display = 'flex';
        postFormSection.style.display = 'block';

        // Get session for auth header
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;

        // Try to get existing profile
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('user_name')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            throw profileError;
        }

        if (profiles) {
            usernameDisplay.textContent = profiles.user_name;
            if (profiles.user_name.startsWith('User')) {
                usernameForm.classList.add('show');
            } else {
                usernameForm.classList.remove('show');
            }
        } else {
            // No profile found, show username form
            usernameDisplay.textContent = 'Set username';
            usernameForm.classList.add('show');
        }

        // Load posts
        await displayPosts();
    } catch (err) {
        console.error('Error in showLoggedInState:', err);
        // Show error message to user
        alert('Error loading profile. Please try refreshing the page. ' + (err.message || ''));
    }
}

// Show logged out state
function showLoggedOutState() {
    authLoggedOut.style.display = 'flex';
    authLoggedIn.style.display = 'none';
    postFormSection.style.display = 'none';
    userEmail.textContent = '';
    usernameForm.classList.remove('show');
}

// Handle username submission
async function handleUsernameSubmit(event) {
    event.preventDefault();
    
    const username = usernameInput.value.trim();
    
    if (username.length < 3 || username.length > 20) {
        alert('Username must be between 3 and 20 characters');
        return;
    }

    if (!username.match(/^[a-zA-Z0-9_]+$/)) {
        alert('Username can only contain letters, numbers, and underscores');
        return;
    }
    
    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError) throw userError;

        // Get session for auth header
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;

        // Check if username is taken by someone else
        const { data: existingUsers, error: checkError } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('user_name', username)
            .neq('id', user.id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        if (existingUsers) {
            alert('Username is already taken. Please choose another one.');
            return;
        }

        // Update profile
        const { data: updateData, error: updateError } = await supabaseClient
            .from('profiles')
            .upsert({ 
                id: user.id,
                user_name: username 
            }, {
                onConflict: 'id'
            })
            .select('user_name')
            .single();

        if (updateError) throw updateError;

        // Update UI
        usernameForm.classList.remove('show');
        usernameDisplay.textContent = username;
        alert('Username updated successfully!');
        
        // Refresh posts
        await displayPosts();
    } catch (error) {
        console.error('Error setting username:', error);
        alert('Error updating username. Please try again. ' + (error.message || ''));
    }
}

// Handle login
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await showLoggedInState(user);
        emailInput.value = '';
        passwordInput.value = '';
    } catch (error) {
        console.error('Error logging in:', error);
        alert(error.message || 'Error logging in');
    }
}

// Handle sign up
async function handleSignUp() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        const { data: { user }, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        alert('Sign up successful! Please check your email for verification.');
        emailInput.value = '';
        passwordInput.value = '';
    } catch (error) {
        console.error('Error signing up:', error);
        alert(error.message || 'Error signing up');
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        showLoggedOutState();
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Error logging out');
    }
}

// Handle form submission
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = imageInput.files[0];
    if (!file) {
        alert('Please select an image');
        return;
    }

    try {
        // First, check if user is logged in
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            alert('Please log in to create a post');
            return;
        }

        // Show loading state
        const submitButton = postForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';

        // Upload image to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('posts')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get the public URL for the uploaded image
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('posts')
            .getPublicUrl(filePath);

        // Create new post object
        const post = {
            image_url: publicUrl,
            caption: captionInput.value,
            user_id: user.id
        };

        // Insert post into Supabase
        const { data, error } = await supabaseClient
            .from('posts')
            .insert([post])
            .select();

        if (error) throw error;

        // Reset form and button
        postForm.reset();
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;

        // Refresh posts display
        await displayPosts();
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Error creating post. Please try again.');
        // Reset button state
        const submitButton = postForm.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Post';
    }
});

// Display posts
async function displayPosts() {
    try {
        // Fetch posts from Supabase
        const { data: posts, error } = await supabaseClient
            .from('posts_with_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        postsContainer.innerHTML = posts.map(post => `
            <article class="post">
                <img src="${post.image_url}" alt="Posted image" class="post-image">
                <div class="post-content">
                    <p class="post-caption">${escapeHtml(post.caption)}</p>
                    <p class="post-author">Posted by: @${escapeHtml(post.user_name || 'Anonymous')}</p>
                    <p class="post-date">${formatDate(post.created_at)}</p>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.error('Error fetching posts:', error);
        postsContainer.innerHTML = '<p>Error loading posts. Please try again later.</p>';
    }
}

// Format date
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add warning for large images
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) { // 5MB
        alert('Warning: Large images may affect performance. Consider using a smaller image.');
    }
}); 