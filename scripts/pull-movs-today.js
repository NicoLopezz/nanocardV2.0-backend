#!/usr/bin/env node

/**
 * Script para importar todos los movimientos Mercury desde enero 2025 hasta hoy
 * Ejecuta el endpoint mes a mes para evitar timeouts
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

// Función principal
async function pullMovsToday() {
  console.log('🚀 Iniciando importación de movimientos Mercury desde enero 2025...');
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
    
    // Estadísticas totales
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalTime = 0;
    
    // Procesar mes por mes
    for (let i = 0; i < monthRanges.length; i++) {
      const range = monthRanges[i];
      
      console.log(`📅 Procesando ${range.month} (${i + 1}/${monthRanges.length})`);
      console.log(`   Rango: ${range.start} → ${range.end}`);
      
      const requestData = {
        start: range.start,
        end: range.end
      };
      
      try {
        const startTime = Date.now();
        
        const response = await makeRequest(`${BASE_URL}${ENDPOINT}`, requestData);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (response.statusCode === 200 && response.data.success) {
          const summary = response.data.summary;
          
          console.log(`   ✅ Éxito (${duration}ms)`);
          console.log(`   📈 Importados: ${summary.imported}`);
          console.log(`   🔄 Actualizados: ${summary.updated}`);
          console.log(`   ❌ Errores: ${summary.errors}`);
          
          // Acumular estadísticas
          totalImported += summary.imported || 0;
          totalUpdated += summary.updated || 0;
          totalErrors += summary.errors || 0;
          totalTime += duration;
          
        } else {
          console.log(`   ❌ Error (${duration}ms)`);
          console.log(`   📝 Respuesta:`, response.data);
          totalErrors++;
        }
        
      } catch (error) {
        console.log(`   ❌ Error de conexión: ${error.message}`);
        totalErrors++;
      }
      
      console.log('');
      
      // Pausa entre meses para evitar sobrecargar el servidor
      if (i < monthRanges.length - 1) {
        console.log('⏳ Pausa de 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Resumen final
    console.log('=' .repeat(60));
    console.log('🎉 IMPORTACIÓN COMPLETADA');
    console.log('=' .repeat(60));
    console.log(`📊 Resumen total:`);
    console.log(`   📈 Total importados: ${totalImported}`);
    console.log(`   🔄 Total actualizados: ${totalUpdated}`);
    console.log(`   ❌ Total errores: ${totalErrors}`);
    console.log(`   ⏱️ Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   📅 Meses procesados: ${monthRanges.length}`);
    
    if (totalErrors === 0) {
      console.log('✅ ¡Todas las importaciones fueron exitosas!');
    } else {
      console.log(`⚠️ Hubo ${totalErrors} errores durante la importación`);
    }
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  pullMovsToday();
}

module.exports = { pullMovsToday };
