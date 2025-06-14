// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// Check initial auth state
checkAuthState();

// Auth state handler
async function checkAuthState() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (user) {
        showLoggedInState(user);
    } else {
        showLoggedOutState();
    }
}

// Show logged in state
function showLoggedInState(user) {
    authLoggedOut.style.display = 'none';
    authLoggedIn.style.display = 'flex';
    postFormSection.style.display = 'block';
    userEmail.textContent = user.email;
}

// Show logged out state
function showLoggedOutState() {
    authLoggedOut.style.display = 'flex';
    authLoggedIn.style.display = 'none';
    postFormSection.style.display = 'none';
    userEmail.textContent = '';
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

        showLoggedInState(user);
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
            .from('posts')
            .select('*, profiles(user_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        postsContainer.innerHTML = posts.map(post => `
            <article class="post">
                <img src="${post.image_url}" alt="Posted image" class="post-image">
                <div class="post-content">
                    <p class="post-caption">${escapeHtml(post.caption)}</p>
                    <p class="post-author">Posted by: ${escapeHtml(post.profiles?.user_name || 'Anonymous')}</p>
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

// Initial display of posts
displayPosts();

// Add warning for large images
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) { // 5MB
        alert('Warning: Large images may affect performance. Consider using a smaller image.');
    }
}); 