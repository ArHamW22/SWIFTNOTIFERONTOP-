const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - NO DELAYS, INSTANT RESPONSE
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for faster processing
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Disable delays
app.set('etag', false); // Disable ETag generation for faster responses

// In-memory storage for pet findings
// Structure: { jobId, placeId, pets: [name1, name2], rates: {name1: rate1, name2: rate2}, timestamp }
let petFindings = [];

// Maximum number of findings to keep in memory (prevent memory overflow)
const MAX_FINDINGS = 100;

// Clean up old findings (older than 15 seconds) - ULTRA FAST CLEANUP
const FINDING_EXPIRY_MS = 15 * 1000; // 15 seconds

function cleanupOldFindings() {
    const now = Date.now();
    petFindings = petFindings.filter(finding => {
        return (now - finding.timestamp) < FINDING_EXPIRY_MS;
    });
    
    // Also limit to MAX_FINDINGS (keep newest)
    if (petFindings.length > MAX_FINDINGS) {
        petFindings = petFindings.slice(-MAX_FINDINGS);
    }
}

// REMOVED: No automatic cleanup intervals - only cleanup on-demand for speed
// Cleanup happens during GET requests instead

// ==========================================
// API ENDPOINTS
// ==========================================

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Brainrot Scanner Backend is running!',
        version: '1.0.0',
        endpoints: {
            submit: 'POST /api/submit',
            getPets: 'GET /api/pets',
            stats: 'GET /api/stats'
        }
    });
});

// Submit new finding from Scanner (Script A)
app.post('/api/submit', (req, res) => {
    try {
        const { jobId, placeId, pets, rates } = req.body;
        
        // Validate required fields
        if (!jobId || !placeId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: jobId and placeId are required'
            });
        }

        if (!pets || !Array.isArray(pets) || pets.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'pets must be a non-empty array'
            });
        }

        // Check for duplicate (same jobId + placeId)
        const existingIndex = petFindings.findIndex(f => 
            f.jobId === jobId && f.placeId === placeId
        );

        const finding = {
            jobId,
            placeId,
            pets,
            rates: rates || {}, // rates is optional, defaults to empty object
            timestamp: Date.now()
        };

        if (existingIndex !== -1) {
            // Update existing finding
            petFindings[existingIndex] = finding;
            console.log(`📝 Updated finding: ${pets.join(', ')} in server ${jobId.substring(0, 8)}...`);
        } else {
            // Add new finding
            petFindings.push(finding);
            console.log(`✨ New finding: ${pets.join(', ')} in server ${jobId.substring(0, 8)}...`);
            
            // Log rates if provided
            if (rates && Object.keys(rates).length > 0) {
                console.log(`   Rates:`, rates);
            }
        }

        // REMOVED: No cleanup on submit for instant response
        // cleanupOldFindings();

        res.json({
            success: true,
            message: 'Finding submitted successfully',
            findingCount: petFindings.length
        });

    } catch (error) {
        console.error('❌ Error in /api/submit:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all findings for Notifier (Script B)
app.get('/api/pets', (req, res) => {
    try {
        // Cleanup old findings (15 seconds expiry)
        cleanupOldFindings();

        // Sort by newest first
        const sortedFindings = [...petFindings].sort((a, b) => b.timestamp - a.timestamp);

        res.json({
            success: true,
            pets: sortedFindings,
            count: sortedFindings.length,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error in /api/pets:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get stats endpoint
app.get('/api/stats', (req, res) => {
    try {
        cleanupOldFindings();

        // Count unique pets
        const uniquePets = new Set();
        petFindings.forEach(finding => {
            finding.pets.forEach(pet => uniquePets.add(pet));
        });

        // Get pet frequency
        const petFrequency = {};
        petFindings.forEach(finding => {
            finding.pets.forEach(pet => {
                petFrequency[pet] = (petFrequency[pet] || 0) + 1;
            });
        });

        // Sort by frequency
        const topPets = Object.entries(petFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pet, count]) => ({ pet, count }));

        res.json({
            success: true,
            stats: {
                totalFindings: petFindings.length,
                uniquePets: uniquePets.size,
                topPets,
                oldestFinding: petFindings.length > 0 ? 
                    new Date(Math.min(...petFindings.map(f => f.timestamp))).toISOString() : null,
                newestFinding: petFindings.length > 0 ? 
                    new Date(Math.max(...petFindings.map(f => f.timestamp))).toISOString() : null
            }
        });

    } catch (error) {
        console.error('❌ Error in /api/stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Clear all findings (useful for testing)
app.post('/api/clear', (req, res) => {
    const count = petFindings.length;
    petFindings = [];
    
    console.log(`🗑️ Cleared ${count} findings`);
    
    res.json({
        success: true,
        message: `Cleared ${count} findings`
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║        🧠 BRAINROT SCANNER BACKEND SERVER 🧠          ║');
    console.log('║              ⚡ ULTRA-FAST MODE ⚡                     ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}`);
    console.log('');
    console.log('⚡ Performance Settings:');
    console.log(`   • Finding expiry: 15 seconds`);
    console.log(`   • Max findings: ${MAX_FINDINGS}`);
    console.log(`   • Auto-cleanup: On every GET request`);
    console.log('');
    console.log('📡 Available Endpoints:');
    console.log(`   POST http://localhost:${PORT}/api/submit   - Submit findings`);
    console.log(`   GET  http://localhost:${PORT}/api/pets     - Get all findings`);
    console.log(`   GET  http://localhost:${PORT}/api/stats    - Get statistics`);
    console.log(`   POST http://localhost:${PORT}/api/clear    - Clear all findings`);
    console.log('');
    console.log('🚀 Ready to receive scan data!');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
});
