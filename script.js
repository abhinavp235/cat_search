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

    const catSleepingSrc = 'cat-sleeping.gif';
    const catStartledSrc = 'cat-startled.gif';
    // --- Constants ---
    const API_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    let chatHistory = [];

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    resetButton.addEventListener('click', handleReset);

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

        searchInput.disabled = true;
        searchButton.disabled = true;
        searchButton.classList.add('searching');
        catImage.src = catStartledSrc;

        addMessageToHistory('user', query);
        displayMessage('user', query);
        searchInput.value = '';

        clearStatus();
        statusArea.style.display = 'block';
        scrollToBottom(chatHistoryDiv);

        try {
            const historyContext = formatHistoryForLLM(chatHistory);

            // 1. Create Plan (Using Real LLM Call - Placeholder Simulation)
            addStatusUpdate('Generating plan...', 'working', 'plan');
            const planPrompt = `${historyContext}\n\nBased on the conversation history and the latest query, create a detailed, actionable plan with numbered steps (e.g., 1., 2.) to comprehensively answer: "${query}". Outline the key areas/topics/questions to research.`;
            // *** REPLACE simulateLLMCall WITH YOUR ACTUAL LLM CALL ***
            const plan = await simulateLLMCall(apiKey, selectedModel, planPrompt, 500); // Simulate getting a plan
            updateStatus('plan', 'Generating plan...', 'done');

            // 2. Identify Areas (Generate *Real* Search Queries from Plan)
            addStatusUpdate('Generating search queries...', 'working', 'areas');
            // *** THIS FUNCTION IS NOW UPDATED ***
            const searchQueries = generateSearchQueriesFromPlan(plan, query);
            await sleep(300); // Simulate processing time
            updateStatus('areas', 'Generating search queries...', 'done');
            addStatusUpdate(`Generated ${searchQueries.length} specific search queries.`, 'info', 'areas-count');
             // Optional: Display generated queries in status
             const queryList = searchQueries.map((q, i) => `<li>${i+1}. ${q}</li>`).join('');
             addStatusUpdate(`Queries:<ul style="font-size: 0.9em; margin-left: -10px; margin-top: 5px;">${queryList}</ul>`, 'info', 'query-list');


            // 3. Fan Out Parallel Grounded Searches (Using Real LLM Calls - Placeholder Simulation)
            addStatusUpdate('Starting parallel grounded searches...', 'working', 'parallel-search');
            const searchPromises = searchQueries.map((searchQuery, index) => {
                const statusId = `search-area-${index}`;
                addStatusUpdate(`Searching (${index + 1}/${searchQueries.length}): ${searchQuery.substring(0, 60)}...`, 'working', statusId);
                // ** IMPORTANT: The prompt for the grounded call should now just use the specific searchQuery **
                // It relies on the grounding mechanism itself to fetch relevant info based on the query.
                // Context might still be useful for the LLM interpreting the search results later, but the search query itself is the key here.
                const groundedSearchPrompt = `Using Google Search results for the query "${searchQuery}", provide the relevant factual information found. Keep it concise and focused on answering that specific query. Context: The overall user goal relates to: "${query}". History:\n${historyContext}`;
                // *** REPLACE simulateLLMCall WITH YOUR ACTUAL GROUNDED LLM CALL ***
                return simulateLLMCall(apiKey, selectedModel, groundedSearchPrompt, 1000 + Math.random() * 1500)
                    .then(result => {
                        updateStatus(statusId, `Searching (${index + 1}/${searchQueries.length}): ${searchQuery.substring(0, 60)}...`, 'done');
                        // Return structured result including the query that was used
                        return { query: searchQuery, result: result };
                    })
                    .catch(error => {
                         console.error(`Error searching query ${index + 1}:`, error);
                         updateStatus(statusId, `Error Searching Query ${index + 1}`, 'error');
                         return { query: searchQuery, result: `Error fetching data for this query.` };
                    });
            });

            const searchResults = await Promise.all(searchPromises);
            updateStatus('parallel-search', 'Parallel grounded searches completed.', 'done');


            // 4. Synthesize Final Answer (Using Real LLM Call - Placeholder Simulation)
            addStatusUpdate('Synthesizing final answer...', 'working', 'synthesis');
            // Include the *search queries* and their results in the synthesis prompt for better traceability
            const synthesisPrompt = `${historyContext}\n\nOriginal Query: "${query}"\n\nResearch Findings (based on specific searches):\n${searchResults.map((r, i) => `Search Query ${i+1}: "${r.query}"\nResult: ${r.result}`).join('\n\n')}\n\nSynthesize a comprehensive, well-structured answer in Markdown format based *only* on the provided research findings and the conversation history. Address the original query directly, integrating the information logically.`;
            // *** REPLACE simulateLLMCall WITH YOUR ACTUAL SYNTHESIS LLM CALL ***
            const finalAnswerMarkdown = await simulateLLMCall(apiKey, selectedModel, synthesisPrompt, 1500);
            updateStatus('synthesis', 'Synthesizing final answer...', 'done');

            addMessageToHistory('model', finalAnswerMarkdown);
            displayMessage('model', finalAnswerMarkdown);

            await sleep(1500);
            statusArea.style.display = 'none';


        } catch (error) {
            console.error("Error during search process:", error);
            addStatusUpdate(`An error occurred: ${error.message}`, 'error', 'main-error');
            const errorMessage = `Sorry, an error occurred while processing your request.\n\n${error.message}`;
             addMessageToHistory('model', errorMessage);
             displayMessage('model', errorMessage);
             statusArea.style.display = 'none';
        } finally {
            searchInput.disabled = false;
            searchButton.disabled = false;
            searchButton.classList.remove('searching');
            catImage.src = catSleepingSrc;
            scrollToBottom(chatHistoryDiv);
        }
    }

    function handleReset() {
        chatHistory = [];
        chatHistoryDiv.innerHTML = '';
        searchInput.value = '';
        clearStatus();
        statusArea.style.display = 'none';
        console.log("Chat reset.");
    }

    function handleCopy(buttonElement, textToCopy) {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const originalText = buttonElement.textContent;
                buttonElement.textContent = '✓';
                buttonElement.style.color = 'green';
                setTimeout(() => {
                    buttonElement.textContent = originalText;
                    buttonElement.style.color = '';
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
    }

    function displayMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', `${role}-message`);
        const messageContentDiv = document.createElement('div');

        if (role === 'model') {
             const cleanContent = cleanMarkdown(content);
             try {
                 messageContentDiv.innerHTML = marked.parse(cleanContent);
             } catch (e) {
                 console.error("Markdown parsing error:", e);
                 messageContentDiv.textContent = "Error rendering Markdown. Displaying raw content:\n" + content;
             }
             const copyBtn = document.createElement('button');
             copyBtn.textContent = '📋';
             copyBtn.title = 'Copy text';
             copyBtn.classList.add('copy-button');
             copyBtn.onclick = (e) => {
                e.stopPropagation();
                 handleCopy(copyBtn, content);
             };
             messageDiv.appendChild(copyBtn);
        } else {
            messageContentDiv.textContent = content;
        }
        messageDiv.appendChild(messageContentDiv);
        chatHistoryDiv.appendChild(messageDiv);
        scrollToBottom(chatHistoryDiv);
    }

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
             li.classList.add('status-error');
             li.style.color = 'red';
         }
         // Use innerHTML to allow basic HTML in status (like the query list)
         li.innerHTML = text; // CAUTION: Only use with trusted input like the generated query list.
        statusUpdatesUl.appendChild(li);
        scrollToBottom(statusUpdatesUl);
    }

     function updateStatus(id, text, newType) {
         const li = document.getElementById(`status-${id}`);
         if (li) {
             li.innerHTML = text; // Allow HTML
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

    function scrollToBottom(element) {
        requestAnimationFrame(() => {
             element.scrollTop = element.scrollHeight;
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

     function formatHistoryForLLM(history) {
        const maxTurns = 10;
        const relevantHistory = history.slice(-maxTurns * 2);
        return relevantHistory.map(turn => `${turn.role === 'user' ? 'User' : 'Model'}: ${turn.content}`)
                              .join('\n');
     }

    // --- Simulation Functions ---

    async function simulateLLMCall(apiKey, selectedModel, prompt, delay) {
        // Note: The prompt now includes history context where needed
        console.log(`Doing call to ${selectedModel}. Prompt starts with: ${prompt.substring(0,150)}...`);
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

    // --- UPDATED FUNCTION ---
    function generateSearchQueriesFromPlan(plan, originalQuery) {
        console.log("Generating search queries from Plan:\n", plan);
        const queries = [];
        const maxQueries = 9;
        const minQueries = 5;

        // Basic keyword extraction from the original query (improves relevance)
        // Simple approach: use significant words (longer than 3 chars, not common stop words)
        const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'to', 'of', 'in', 'it', 'and', 'or', 'for', 'on', 'with', 'as', 'by', 'at', 'from', 'what', 'who', 'when', 'where', 'why', 'how', 'tell', 'me', 'about', 'create', 'give', 'provide']);
        const queryKeywords = originalQuery.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word.replace(/[^\w]/g, '')))
            .slice(0, 5); // Limit keyword count

        // Try to parse numbered or bulleted items from the plan
        const planItems = plan.match(/^(?:\d+\.|[-*+]\s+)(.*)/gm); // Matches lines starting with number+dot or bullet

        if (planItems && planItems.length > 0) {
            planItems.forEach(item => {
                // Clean the item: remove numbering/bullet, trim whitespace
                let topic = item.replace(/^(?:\d+\.|[-*+]\s+)/, '').trim();
                if (topic.length < 10) return; // Skip very short items

                // Combine plan topic with original query keywords for specificity
                let searchQuery = `${topic} related to ${queryKeywords.join(' ')}`;
                queries.push(searchQuery.substring(0, 200)); // Limit query length

                 // Add variations or related questions for depth
                if (queries.length < maxQueries) {
                    queries.push(`Can you analyze different aspects (positive, negative and other areas..) of ${topic.split(' ')[0]} ${topic.split(' ')[1] || ''} in context of ${queryKeywords[0] || originalQuery.split(' ')[0]}`);
                }
                 if (queries.length < maxQueries && topic.toLowerCase().includes("anal") || topic.toLowerCase().includes("invest")) { // analyze/investigate
                    queries.push(`recent developments or news about ${topic}`);
                }
                 if (queries.length < maxQueries && topic.toLowerCase().includes("defin")) { // define
                    queries.push(`examples of ${topic}`);
                }
            });
        }

        // Ensure Core Query Coverage (Overlap)
        if (queries.length < maxQueries) {
             queries.push(`detailed overview of ${originalQuery}`);
        }
        if (queries.length < maxQueries) {
             queries.push(`key aspects of ${originalQuery}`);
        }

        // Add Fallback / Broadening Queries if not enough generated yet
        if (queries.length < minQueries) {
             queries.push(`latest news about ${originalQuery}`);
             queries.push(`benefits of ${originalQuery}`);
             queries.push(`challenges of ${originalQuery}`);
             queries.push(`how does ${originalQuery} work`);
        }

        // Ensure minimum/maximum number of queries and uniqueness
        const uniqueQueries = [...new Set(queries)];
        const finalQueries = uniqueQueries.slice(0, maxQueries);

        // Ensure we have at least minQueries if possible, add generic if desperate
         while (finalQueries.length < minQueries && finalQueries.length < uniqueQueries.length) {
             // This loop condition seems complex, simplify:
             // If we have fewer than minQueries, but there are more unique ones available, add them.
              const nextUnique = uniqueQueries[finalQueries.length];
               if(nextUnique) finalQueries.push(nextUnique);
               else break; // No more unique queries left
         }
          // If still too few, add very generic ones (less ideal)
         let genericCounter = 1;
         while (finalQueries.length < minQueries) {
             finalQueries.push(`background information on ${queryKeywords[0] || originalQuery.split(' ')[0]} part ${genericCounter++}`);
         }


        console.log("Generated Search Queries:", finalQueries);
        return finalQueries;
    }


    // --- Initial Setup ---
    console.log("Deep Search Interface Initialized (v2 - Chat Thread).");
});