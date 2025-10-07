#!/usr/bin/env node

/**
 * Script OPTIMIZADO para importar todos los movimientos Mercury desde enero 2025 hasta hoy
 * Ejecuta el endpoint en paralelo para mejor rendimiento
 */

require('dotenv').config();

const https = require('https');
const http = require('http');

// Configuración
const BASE_URL = 'http://localhost:3001';
const ENDPOINT = '/api/real-mercury/import-all-transactions';

// Función para hacer petición HTTP
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (error) {
          reject(new Error(`Error parsing response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Función para generar fechas de mes
function generateMonthRanges(startDate, endDate) {
  const ranges = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth();
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    
    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);
    
    // Ajustar si el último día es después de endDate
    const actualLastDay = lastDay > endDate ? endDate : lastDay;
    
    ranges.push({
      start: formatDate(firstDay),
      end: formatDate(actualLastDay),
      month: `${year}-${String(month + 1).padStart(2, '0')}`
    });
    
    // Avanzar al siguiente mes
    current.setMonth(month + 1);
  }
  
  return ranges;
}

// Función para formatear fecha como YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Función principal OPTIMIZADA
async function pullMovsTodayOptimized() {
  console.log('🚀 Iniciando importación OPTIMIZADA de movimientos Mercury desde enero 2025...');
  console.log('⚡ OPTIMIZACIÓN: Procesamiento en paralelo para mejor rendimiento');
  console.log('=' .repeat(60));
  
  try {
    // Fechas: desde 1 enero 2025 hasta hoy
    const startDate = new Date('2025-01-01');
    const endDate = new Date();
    
    console.log(`📅 Rango de fechas: ${formatDate(startDate)} → ${formatDate(endDate)}`);
    
    // Generar rangos de meses
    const monthRanges = generateMonthRanges(startDate, endDate);
    
    console.log(`📊 Total de meses a procesar: ${monthRanges.length}`);
    console.log('');
    
    // OPTIMIZACIÓN: Procesar en lotes paralelos
    const BATCH_SIZE = 3; // Procesar 3 meses en paralelo
    const batches = [];
    for (let i = 0; i < monthRanges.length; i += BATCH_SIZE) {
      batches.push(monthRanges.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`⚡ Procesando en ${batches.length} lotes de ${BATCH_SIZE} meses en paralelo`);
    console.log('');
    
    // Estadísticas totales
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalTime = 0;
    
    // Procesar lotes en paralelo
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      console.log(`🔄 Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} meses)`);
      
      // Procesar meses del lote en paralelo
      const batchPromises = batch.map(async (range, index) => {
        try {
          console.log(`   📅 [${batchIndex + 1}.${index + 1}] Procesando ${range.month}`);
          console.log(`      Rango: ${range.start} → ${range.end}`);
          
          const requestData = {
            start: range.start,
            end: range.end
          };
          
          const startTime = Date.now();
          const response = await makeRequest(`${BASE_URL}${ENDPOINT}`, requestData);
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          if (response.statusCode === 200 && response.data.success) {
            const imported = response.data.summary?.transactionsImported || 0;
            const updated = response.data.summary?.transactionsUpdated || 0;
            
            console.log(`      ✅ ${range.month}: ${imported} importadas, ${updated} actualizadas (${duration}ms)`);
            
            return {
              month: range.month,
              imported,
              updated,
              duration,
              success: true
            };
          } else {
            throw new Error(`HTTP ${response.statusCode}: ${response.data?.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`      ❌ ${range.month}: Error - ${error.message}`);
          return {
            month: range.month,
            imported: 0,
            updated: 0,
            duration: 0,
            success: false,
            error: error.message
          };
        }
      });
      
      // Esperar a que termine el lote
      const batchResults = await Promise.all(batchPromises);
      
      // Procesar resultados del lote
      batchResults.forEach(result => {
        if (result.success) {
          totalImported += result.imported;
          totalUpdated += result.updated;
          totalTime += result.duration;
        } else {
          totalErrors++;
        }
      });
      
      console.log(`   📊 Lote ${batchIndex + 1} completado: ${batchResults.filter(r => r.success).length}/${batch.length} exitosos`);
      console.log('');
    }
    
    const totalDuration = Date.now() - Date.now();
    const avgTimePerMonth = totalTime / monthRanges.length;
    
    console.log('🎉 Importación OPTIMIZADA completada!');
    console.log('=' .repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   - Meses procesados: ${monthRanges.length}`);
    console.log(`   - Transacciones importadas: ${totalImported}`);
    console.log(`   - Transacciones actualizadas: ${totalUpdated}`);
    console.log(`   - Errores: ${totalErrors}`);
    console.log(`   - Tiempo promedio por mes: ${avgTimePerMonth.toFixed(2)}ms`);
    console.log(`   - Tiempo total: ${totalDuration}ms`);
    console.log(`⚡ OPTIMIZACIÓN: Procesamiento en paralelo completado`);
    
  } catch (error) {
    console.error('❌ Error durante la importación optimizada:', error);
    throw error;
  }
}

if (require.main === module) {
  pullMovsTodayOptimized()
    .then(() => {
      console.log('✅ Script optimizado completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script optimizado falló:', error);
      process.exit(1);
    });
}

module.exports = { pullMovsTodayOptimized };
