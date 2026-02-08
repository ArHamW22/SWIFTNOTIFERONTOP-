const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - NO DELAYS, INSTANT RESPONSE
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Disable delays
app.set('etag', false);

// In-memory storage for pet findings
let petFindings = [];

// Maximum number of findings to keep in memory
const MAX_FINDINGS = 100;

// Clean up old findings (older than 15 seconds) - ULTRA FAST CLEANUP
const FINDING_EXPIRY_MS = 15 * 1000; // 15 seconds

function cleanupOldFindings() {
    const now = Date.now();
    petFindings = petFindings.filter(finding => {
        return (now - finding.timestamp) < FINDING_EXPIRY_MS;
    });
    
    if (petFindings.length > MAX_FINDINGS) {
        petFindings = petFindings.slice(-MAX_FINDINGS);
    }
}

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

// Submit new finding from Scanner
app.post('/api/submit', (req, res) => {
    try {
        const { jobId, placeId, pets, rates } = req.body;
        
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

        const existingIndex = petFindings.findIndex(f => 
            f.jobId === jobId && f.placeId === placeId
        );

        const finding = {
            jobId,
            placeId,
            pets,
            rates: rates || {},
            timestamp: Date.now()
        };

        if (existingIndex !== -1) {
            petFindings[existingIndex] = finding;
            console.log(`📝 Updated finding: ${pets.join(', ')} in server ${jobId.substring(0, 8)}...`);
        } else {
            petFindings.push(finding);
            console.log(`✨ New finding: ${pets.join(', ')} in server ${jobId.substring(0, 8)}...`);
            
            if (rates && Object.keys(rates).length > 0) {
                console.log(`   Rates:`, rates);
            }
        }

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

// Get all findings for Notifier
app.get('/api/pets', (req, res) => {
    try {
        cleanupOldFindings();

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

        const uniquePets = new Set();
        petFindings.forEach(finding => {
            finding.pets.forEach(pet => uniquePets.add(pet));
        });

        const petFrequency = {};
        petFindings.forEach(finding => {
            finding.pets.forEach(pet => {
                petFrequency[pet] = (petFrequency[pet] || 0) + 1;
            });
        });

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

// Clear all findings
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
