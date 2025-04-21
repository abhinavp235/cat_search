document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('modelSelect');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const catImage = document.getElementById('catImage');
    const resetButton = document.getElementById('resetButton');
    const chatHistoryDiv = document.getElementById('chatHistory');
    const statusArea = document.getElementById('statusArea');
    const statusUpdatesUl = document.getElementById('statusUpdates');
    // Removed finalAnswerArea related elements

    const catSleepingSrc = 'cat-sleeping.png';
    const catStartledSrc = 'cat-startled.png';

    // --- Constants ---
    const API_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    let chatHistory = []; // Array to store { role: 'user'/'model', content: '...' }
    // Removed currentFinalAnswer variable

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    resetButton.addEventListener('click', handleReset);
    // Copy button event listeners are now added dynamically in displayMessage

    // --- Core Logic Functions ---

    async function handleSearch() {
        const query = searchInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;

        if (!query) {
            alert("Please enter a search query.");
            return;
        }
        if (!apiKey) {
            alert("Please enter your Google API Key.");
            return;
        }

        // Disable input during processing
        searchInput.disabled = true;
        searchButton.disabled = true;
        searchButton.classList.add('searching');
        catImage.src = catStartledSrc; // Startled cat

        // Add user message to history and display
        addMessageToHistory('user', query);
        displayMessage('user', query); // Display user message immediately
        searchInput.value = ''; // Clear input field

        // Reset and show status area
        clearStatus();
        statusArea.style.display = 'block';
        scrollToBottom(chatHistoryDiv); // Scroll down after user message

        try {
            // Prepare context from chat history for the LLM
            const historyContext = formatHistoryForLLM(chatHistory); // Get formatted history (user/model turns)

            // 1. Create Plan (Simulated with context)
            addStatusUpdate('Generating plan...', 'working', 'plan');
            const planPrompt = `${historyContext}\n\nBased on the conversation history and the latest query, create a detailed plan to comprehensively answer: "${query}". Outline the key areas to research.`;
            const plan = await simulateLLMCall(apiKey, selectedModel, planPrompt, 500);
            updateStatus('plan', 'Generating plan...', 'done');
            // Optionally display plan in status if needed: addStatusUpdate(`Plan generated:\n${plan}`, 'info', 'plan-details');

            // 2. Identify Areas (Simulated - derived from plan)
            addStatusUpdate('Identifying distinct search areas...', 'working', 'areas');
            const areas = generateSimulatedAreas(plan, query); // Simulate 5-9 areas
            await sleep(300); // Simulate processing time
            updateStatus('areas', 'Identifying distinct search areas...', 'done');
            addStatusUpdate(`Identified ${areas.length} areas to investigate.`, 'info', 'areas-count');

            // 3. Fan Out Parallel Calls (Simulated with context)
            addStatusUpdate('Starting parallel grounded searches...', 'working', 'parallel-search');
            const searchPromises = areas.map((area, index) => {
                const statusId = `search-area-${index}`;
                addStatusUpdate(`Searching Area ${index + 1}/${areas.length}: ${area.substring(0, 50)}...`, 'working', statusId);
                const searchPrompt = `${historyContext}\n\nOriginal Query: "${query}"\nCurrent Research Area: Provide detailed, factual information about "${area}" based on Google Search results relevant to the original query and conversation history.`;
                // *** Replace simulateLLMCall with actual grounded search API call for each area ***
                return simulateLLMCall(apiKey, selectedModel, searchPrompt, 1000 + Math.random() * 1500)
                    .then(result => {
                        updateStatus(statusId, `Searching Area ${index + 1}/${areas.length}: ${area.substring(0, 50)}...`, 'done');
                        return { area: area, result: result };
                    })
                    .catch(error => {
                         console.error(`Error searching area ${index + 1}:`, error);
                         updateStatus(statusId, `Error in Area ${index + 1}`, 'error');
                         return { area: area, result: `Error fetching data for this area.` };
                    });
            });

            const searchResults = await Promise.all(searchPromises);
            updateStatus('parallel-search', 'Parallel grounded searches completed.', 'done');


            // 4. Synthesize Final Answer (Simulated with context)
            addStatusUpdate('Synthesizing final answer...', 'working', 'synthesis');
            const synthesisPrompt = `${historyContext}\n\nOriginal Query: "${query}"\n\nResearch Findings:\n${searchResults.map((r, i) => `Area ${i+1} (${r.area}):\n${r.result}`).join('\n\n')}\n\nSynthesize a comprehensive, well-structured answer in Markdown format based *only* on the provided research findings and the conversation history. Address the original query directly.`;
            // *** Replace simulateLLMCall with the actual synthesis API call ***
            const finalAnswerMarkdown = await simulateLLMCall(apiKey, selectedModel, synthesisPrompt, 1500);
            updateStatus('synthesis', 'Synthesizing final answer...', 'done');

            // Display final answer AS a model message in the chat history
            addMessageToHistory('model', finalAnswerMarkdown); // Add to history first
            displayMessage('model', finalAnswerMarkdown);    // Then display it

            // Hide status details after a short delay or keep open?
            await sleep(1500);
             statusArea.style.display = 'none'; // Hide status area after completion
             // Or just collapse it: statusArea.querySelector('details').removeAttribute('open');


        } catch (error) {
            console.error("Error during search process:", error);
            addStatusUpdate(`An error occurred: ${error.message}`, 'error', 'main-error');
            const errorMessage = `Sorry, an error occurred while processing your request.\n\n${error.message}`;
             addMessageToHistory('model', errorMessage);
             displayMessage('model', errorMessage);
             statusArea.style.display = 'none'; // Hide status on error too
        } finally {
            // Re-enable input
            searchInput.disabled = false;
            searchButton.disabled = false;
            searchButton.classList.remove('searching');
            catImage.src = catSleepingSrc; // Back to sleeping cat
            scrollToBottom(chatHistoryDiv); // Scroll chat history
        }
    }

    function handleReset() {
        chatHistory = [];
        chatHistoryDiv.innerHTML = '';
        searchInput.value = '';
        clearStatus();
        statusArea.style.display = 'none';
        // apiKeyInput.value = ''; // Keep API key usually
        console.log("Chat reset.");
    }

    function handleCopy(buttonElement, textToCopy) {
        // Renamed function to avoid conflict with element ID if any
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                // Optional: Show a temporary "Copied!" message
                const originalText = buttonElement.textContent; // Store original icon/text
                buttonElement.textContent = '✓'; // Checkmark for copied
                buttonElement.style.color = 'green';
                setTimeout(() => {
                    buttonElement.textContent = originalText; // Restore icon/text
                    buttonElement.style.color = ''; // Restore color
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy text.');
            });
    }

    // --- UI Update Functions ---

    function addMessageToHistory(role, content) {
        chatHistory.push({ role, content });
        // Add logic here to trim history if it gets too long for the context window
    }

    function displayMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', `${role}-message`);

        const messageContentDiv = document.createElement('div'); // Container for text content

        if (role === 'model') {
             // Render markdown for model messages
             const cleanContent = cleanMarkdown(content);
             try {
                 messageContentDiv.innerHTML = marked.parse(cleanContent); // Use marked library
             } catch (e) {
                 console.error("Markdown parsing error:", e);
                 messageContentDiv.textContent = "Error rendering Markdown. Displaying raw content:\n" + content;
             }

             // Add copy button to model messages
             const copyBtn = document.createElement('button');
             copyBtn.textContent = '📋'; // Copy icon
             copyBtn.title = 'Copy text';
             copyBtn.classList.add('copy-button');
             copyBtn.onclick = (e) => {
                // Prevent event bubbling if needed
                e.stopPropagation();
                 handleCopy(copyBtn, content); // Pass raw content to copy
             };
             messageDiv.appendChild(copyBtn);

        } else {
            messageContentDiv.textContent = content; // User messages as plain text
        }

        messageDiv.appendChild(messageContentDiv); // Add content to the main message div
        chatHistoryDiv.appendChild(messageDiv);
        scrollToBottom(chatHistoryDiv);
    }

     // Removed displayFinalAnswer function as it's merged into displayMessage

     function cleanMarkdown(md) {
         const mdFenceRegex = /^```(?:md|markdown)\s*\n([\s\S]*?)\n```$/;
         const match = md.match(mdFenceRegex);
         if (match && match[1]) {
             return match[1].trim();
         }
         md = md.replace(/^```\s*\n/, '').replace(/\n```$/, '');
         return md.trim();
     }

    function addStatusUpdate(text, type = 'info', id = null) {
        const li = document.createElement('li');
        if (id) li.id = `status-${id}`;

        if (type === 'working') li.classList.add('status-working');
         else if (type === 'done') li.classList.add('status-done');
         else if (type === 'error') {
             li.classList.add('status-error'); // Add CSS for .status-error if needed
             li.style.color = 'red'; // Simple error styling
         }
        li.textContent = text;
        statusUpdatesUl.appendChild(li);
        scrollToBottom(statusUpdatesUl);
    }

     function updateStatus(id, text, newType) {
         const li = document.getElementById(`status-${id}`);
         if (li) {
             li.textContent = text;
             li.classList.remove('status-working', 'status-done', 'status-error', 'status-info');
             if (newType === 'working') li.classList.add('status-working');
             else if (newType === 'done') li.classList.add('status-done');
             else if (newType === 'error') {
                 li.classList.add('status-error');
                 li.style.color = 'red';
             }
             else li.classList.add('status-info');
         }
     }

    function clearStatus() {
        statusUpdatesUl.innerHTML = '';
    }

    // Removed clearFinalAnswer function

    function scrollToBottom(element) {
        // Use requestAnimationFrame for smoother scrolling after DOM updates
        requestAnimationFrame(() => {
             element.scrollTop = element.scrollHeight;
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

     // --- History Formatting ---
     function formatHistoryForLLM(history) {
        // Simple formatting: Combine user/model turns.
        // Limit history length if needed to avoid exceeding context limits.
        const maxTurns = 10; // Example: Keep last 10 turns (5 user, 5 model)
        const relevantHistory = history.slice(-maxTurns * 2); // Get last N messages

        return relevantHistory.map(turn => `${turn.role === 'user' ? 'User' : 'Model'}: ${turn.content}`)
                              .join('\n');
     }

    // --- Simulation Functions (Now receive context) ---

    async function simulateLLMCall(apiKey, selectedModel, prompt, delay) {
        // Note: The prompt now includes history context where needed
        console.log(`Simulating call to ${selectedModel}. Prompt starts with: ${prompt.substring(0,150)}...`);
        const endpoint = `${API_ENDPOINT_BASE}${selectedModel}:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            // Lower temperature slightly for planning/synthesis? Optional.
            // generationConfig: { temperature: isPlanning ? 0.5 : 0.7 },
        };
        requestBody.tools = [{ googleSearch: {} }];
        console.log("Attempting to use Google Search grounding.");

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorBody = await response.text();
                try { errorBody = JSON.parse(errorBody); } catch (e) { /* Use text */ }
                 console.error("  _internalLlmCall Error Response:", errorBody);
                throw new Error(`Internal API call failed: ${response.status} ${response.statusText} - ${errorBody?.error?.message || JSON.stringify(errorBody)}`);
            }
            const data = await response.json();

            // Basic response extraction (similar to original)
            const candidate = data?.candidates?.[0];
            const contentPart = candidate?.content?.parts?.[0];
             if (contentPart && typeof contentPart.text === 'string') {
                 return contentPart.text;
             } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                  throw new Error(`Internal API call finished unexpectedly. Reason: ${candidate.finishReason}`);
             } else if (data.promptFeedback?.blockReason) {
                  throw new Error(`Internal Request blocked: ${data.promptFeedback.blockReason}`);
             } else {
                 throw new Error("Could not extract text from internal API response.");
             }
        } catch (error) {
            console.error("  _internalLlmCall Fetch/Processing Error:", error);
            throw error; // Re-throw to be caught by main logic
        }
    }

    function generateSimulatedAreas(plan, query) {
        // Keep previous simulation logic, plan itself might be different due to context
        const baseAreas = plan.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(line => line.length > 5);
        let areas = [...baseAreas];
        const keywordMatch = query.match(/\b[A-Z]?[a-z]+(?: [A-Z]?[a-z]+)*\b/g)?.slice(0, 5); // Extract potential phrases
         if(keywordMatch) areas.push(...keywordMatch);

        const targetCount = 5 + Math.floor(Math.random() * 5); // 5 to 9
        while(areas.length < targetCount) {
            areas.push(`Related aspect ${areas.length + 1} of "${query.substring(0,20)}..." based on context`);
        }
        areas = [...new Set(areas)].slice(0, targetCount);
        if (areas.length < 5 && areas.length > 0) {
            while(areas.length < 5) areas.push(`Generic Area ${areas.length + 1} (context adjusted)`);
        } else if (areas.length === 0) {
             areas = [`Core topic of "${query.substring(0,20)}..."`, "Background information", "Current implications", "Related examples", "Expert opinions"];
        }
        console.log("Simulated Areas (with context):", areas);
        return areas;
    }


    // --- Initial Setup ---
    console.log("Deep Search Interface Initialized (v2 - Chat Thread).");
    // Load initial state or welcome message if desired
    // displayMessage('model', 'Hello! How can I help you with a deep search today?');
    // addMessageToHistory('model', 'Hello! How can I help you with a deep search today?');
});