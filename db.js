import pg from 'pg';
import dotenv from 'dotenv';
import net from 'net';

dotenv.config();

const { Pool } = pg;

// Resilient in-memory database store for local dev or when PostgreSQL server is offline
const inMemoryDb = {
  patients: [
    { id: 1, name: 'Marcus Thorne', phone: '+1 (310) 555-0192', email: 'marcus@thorne.com', medical_history: 'No known allergies. Sensitive lower molars.', created_at: new Date('2026-10-15T09:30:00Z') },
    { id: 2, name: 'Sophia Sterling', phone: '+1 (310) 555-0144', email: 'sophia@sterling.org', medical_history: 'Porcelain veneers candidate. Prior whitening.', created_at: new Date('2026-10-20T14:15:00Z') },
    { id: 3, name: 'David Chen', phone: '+1 (310) 555-0812', email: 'david@chen.io', medical_history: 'Wisdom teeth extraction completed 2024.', created_at: new Date('2026-10-28T11:00:00Z') }
  ],
  appointments: [
    { id: 101, patient_name: 'Marcus Thorne', patient_phone: '+1 (310) 555-0192', service_name: 'Teeth Cleaning & Scaling', appointment_date: '2026-11-05', time_slot: '10:30 AM', status: 'Pending', created_at: new Date('2026-11-01T08:00:00Z') },
    { id: 102, patient_name: 'Sophia Sterling', patient_phone: '+1 (310) 555-0144', service_name: 'Teeth Whitening (Bleaching)', appointment_date: '2026-11-06', time_slot: '02:00 PM', status: 'Confirmed', created_at: new Date('2026-11-01T09:30:00Z') }
  ],
  services: [
    { id: 1, name: 'Teeth Cleaning & Scaling', description: 'Professional Plaque & Tartar Removal', price: 95.00, duration_minutes: 45, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 2, name: 'Tooth Fillings (Cavity Treatment)', description: 'Composite & Natural Resin Restoration', price: 120.00, duration_minutes: 60, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 3, name: 'Root Canal Treatment (RCT)', description: 'Microscopic Nerve & Pulp Healing', price: 350.00, duration_minutes: 90, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 4, name: 'Teeth Whitening (Bleaching)', description: 'Cold-Light Laser Enamel Brightening', price: 280.00, duration_minutes: 45, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 5, name: 'Gum Treatment (Periodontal Care)', description: 'Gingivitis, Bleeding & Laser Periodontal Therapy', price: 150.00, duration_minutes: 50, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 6, name: 'Dentures (Artificial Teeth Set)', description: 'Complete & Partial Flexible Acrylic Plates', price: 450.00, duration_minutes: 60, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 7, name: 'Invisible Clear Aligners', description: '3D Orthodontic Trays & Custom Aligners', price: 1200.00, duration_minutes: 30, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 8, name: 'Dental Crowns & Bridges', description: 'Zirconia & Ceramic Cap Restorations', price: 300.00, duration_minutes: 60, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 9, name: 'Wisdom Tooth Extraction', description: 'Gentle & Surgical Wisdom Tooth Removal', price: 200.00, duration_minutes: 45, created_at: new Date('2026-09-01T08:00:00Z') },
    { id: 10, name: 'Pediatric Dental Care', description: 'Gentle Child Dentistry & Preventive Fluoride Shield', price: 80.00, duration_minutes: 30, created_at: new Date('2026-09-01T08:00:00Z') }
  ],
  inquiries: [
    { id: 1, name: 'David Chen', phone: '+1 (310) 555-0812', email: 'david@chen.io', message: 'Hi, I would like to inquire about same-day 3D digital smile previews.', status: 'Unread', created_at: new Date('2026-11-02T10:14:00Z') }
  ],
  doctors: [
    { id: 1, name: 'Dr. Ahmed Khan', specialty: 'Prosthodontist', experience_years: 12, bio: 'Specialist in dental implants and aesthetic porcelain restorations.', availability: 'Mon - Fri', created_at: new Date() },
    { id: 2, name: 'Dr. Sarah Ahmed', specialty: 'Orthodontist', experience_years: 8, bio: 'Expert in invisible aligners and pediatric orthodontics.', availability: 'Mon, Wed, Fri', created_at: new Date() },
    { id: 3, name: 'Dr. Usman Ali', specialty: 'Endodontist', experience_years: 10, bio: 'Root canal specialist using microscopic laser technology.', availability: 'Tue, Thu, Sat', created_at: new Date() },
    { id: 4, name: 'Dr. Maria Zain', specialty: 'Oral Surgeon', experience_years: 15, bio: 'Expert in wisdom tooth extractions and complex dental surgeries.', availability: 'Mon - Thu', created_at: new Date() },
    { id: 5, name: 'Dr. Hassan Raza', specialty: 'General Dentist', experience_years: 7, bio: 'Passionate about preventive care and painless dentistry.', availability: 'Daily', created_at: new Date() }
  ]
};

// PostgreSQL Connection state
let pool = null;
let isPostgresAvailable = false;
let connectionProbePromise = null;

/**
 * Probe TCP port cleanly using a raw socket without triggering unhandled exceptions
 * or dumping ECONNREFUSED stack traces to the terminal logs.
 */
function probeTcpPort(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (!settled) {
        settled = true;
        try { socket.destroy(); } catch {}
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));

    try {
      socket.connect(port, host);
    } catch {
      finalize(false);
    }
  });
}

/**
 * Safely verify whether a live PostgreSQL server is listening before creating/querying the pool.
 * Falls back immediately to the resilient in-memory database store if unreachable,
 * completely preventing ECONNREFUSED crashes and console log alarms.
 */
async function seedServices(client) {
  const seedData = [
    ['Teeth Cleaning & Scaling', 'Professional Plaque & Tartar Removal', 95.00, 45],
    ['Tooth Fillings (Cavity Treatment)', 'Composite & Natural Resin Restoration', 120.00, 60],
    ['Root Canal Treatment (RCT)', 'Microscopic Nerve & Pulp Healing', 350.00, 90],
    ['Teeth Whitening (Bleaching)', 'Cold-Light Laser Enamel Brightening', 280.00, 45],
    ['Gum Treatment (Periodontal Care)', 'Gingivitis, Bleeding & Laser Periodontal Therapy', 150.00, 50],
    ['Dentures (Artificial Teeth Set)', 'Complete & Partial Flexible Acrylic Plates', 450.00, 60],
    ['Invisible Clear Aligners', '3D Orthodontic Trays & Custom Aligners', 1200.00, 30],
    ['Dental Crowns & Bridges', 'Zirconia & Ceramic Cap Restorations', 300.00, 60],
    ['Wisdom Tooth Extraction', 'Gentle & Surgical Wisdom Tooth Removal', 200.00, 45],
    ['Pediatric Dental Care', 'Gentle Child Dentistry & Preventive Fluoride Shield', 80.00, 30]
  ];

  for (const [name, desc, price, duration] of seedData) {
    await client.query(
      `INSERT INTO services (name, description, price, duration_minutes) 
       SELECT $1, $2, $3, $4 
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = $1)`,
      [name, desc, price, duration]
    );
  }
}

async function seedDoctors(client) {
  const seedData = [
    ['Dr. Ahmed Khan', 'Prosthodontist', 12, 'Specialist in dental implants and aesthetic porcelain restorations.', 'Mon - Fri'],
    ['Dr. Sarah Ahmed', 'Orthodontist', 8, 'Expert in invisible aligners and pediatric orthodontics.', 'Mon, Wed, Fri'],
    ['Dr. Usman Ali', 'Endodontist', 10, 'Root canal specialist using microscopic laser technology.', 'Tue, Thu, Sat'],
    ['Dr. Maria Zain', 'Oral Surgeon', 15, 'Expert in wisdom tooth extractions and complex dental surgeries.', 'Mon - Thu'],
    ['Dr. Hassan Raza', 'General Dentist', 7, 'Passionate about preventive care and painless dentistry.', 'Daily']
  ];

  for (const [name, specialty, exp, bio, avail] of seedData) {
    await client.query(
      `INSERT INTO doctors (name, specialty, experience_years, bio, availability) 
       SELECT $1, $2, $3, $4, $5 
       WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = $1)`,
      [name, specialty, exp, bio, avail]
    );
  }
}

async function ensureDbState() {
  if (connectionProbePromise) {
    return connectionProbePromise;
  }

  connectionProbePromise = (async () => {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
      console.log('ℹ️ [DB LAYER] No DATABASE_URL provided. Initializing in-memory clinic store.');
      isPostgresAvailable = false;
      return false;
    }

    let host = '127.0.0.1';
    let port = 5432;
    try {
      const parsed = new URL(rawUrl);
      host = parsed.hostname || '127.0.0.1';
      port = parsed.port ? Number(parsed.port) : 5432;
    } catch {
      // Default to 127.0.0.1:5432
    }

    const reachable = await probeTcpPort(host, port, 400);
    if (!reachable) {
      console.log(`ℹ️ [DB LAYER] PostgreSQL server not listening on ${host}:${port}. Operating in resilient high-performance in-memory database mode.`);
      isPostgresAvailable = false;
      return false;
    }

    try {
      const candidatePool = new Pool({
        connectionString: rawUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      candidatePool.on('error', (err) => {
        console.warn('⚠️ [PG POOL WARNING]:', err.message);
      });

      const client = await candidatePool.connect();
      await client.query('SELECT 1');
      
      // Auto-seed services
      await seedServices(client);
      await seedDoctors(client);
      
      client.release();

      pool = candidatePool;
      isPostgresAvailable = true;
      console.log(`✅ [DB LAYER] Connected and Seeded successfully to PostgreSQL database at ${host}:${port}`);
      return true;
    } catch (connErr) {
      console.log(`ℹ️ [DB LAYER] PostgreSQL handshake skipped (${connErr.message}). In-memory store active.`);
      isPostgresAvailable = false;
      if (pool) {
        try { await pool.end(); } catch {}
        pool = null;
      }
      return false;
    }
  })();

  return connectionProbePromise;
}

// Initiate background probe on module load
ensureDbState();

export default {
  /**
   * Centralized query executor supporting strict parameterized queries ($1, $2, etc.)
   * Logs exact SQL query, mapped parameters, execution duration in milliseconds,
   * and complete error stack traces to CMD terminal for real exceptions.
   */
  query: async (text, params = []) => {
    const startTime = Date.now();
    const normalizedSql = text.trim().replace(/\s+/g, ' ');

    console.log('--------------------------------------------------');
    console.log('🗄️ [DB LAYER] Executing PostgreSQL Query');
    console.log('📝 SQL String:', normalizedSql);
    console.log('📊 Mapped Parameters ($1, $2...):', JSON.stringify(params, null, 2));

    await ensureDbState();

    if (isPostgresAvailable && pool) {
      try {
        const poolResult = await pool.query(text, params);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER] Query Executed Successfully via PostgreSQL Pool in ${duration}ms`);
        console.log(`📦 Rows Returned: ${poolResult.rows ? poolResult.rows.length : 0}`);
        console.log('--------------------------------------------------');
        return poolResult;
      } catch (err) {
        const duration = Date.now() - startTime;
        console.error('🔥 [CRITICAL DATABASE ERROR] PostgreSQL Query Execution Failed:');
        console.error(`⏱️ Query Failed after: ${duration}ms`);
        console.error('🛑 Error Message:', err.message);
        console.error('📍 Full Database Error Stack Trace:\n', err.stack);
        console.log('--------------------------------------------------');
        throw err;
      }
    }

    // SQL Processor for In-Memory Fallback
    try {
      const sqlLower = text.trim().toLowerCase();

      // 0. Doctors Select, Insert, Update, Delete
      if (sqlLower.includes('from doctors')) {
        const duration = Date.now() - startTime;
        if (sqlLower.includes('where id = $1')) {
          const doctor = inMemoryDb.doctors.find(d => d.id === Number(params[0]));
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Doctor #${params[0]} query finished in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: doctor ? [doctor] : [] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Fetched ${inMemoryDb.doctors.length} doctors in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: inMemoryDb.doctors };
      }

      if (sqlLower.includes('insert into doctors')) {
        const [name, specialty, experience_years, bio, availability] = params;
        const newDoctor = {
          id: inMemoryDb.doctors.length + 1,
          name,
          specialty,
          experience_years: Number(experience_years),
          bio,
          availability,
          created_at: new Date()
        };
        inMemoryDb.doctors.push(newDoctor);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Inserted doctor #${newDoctor.id} in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [newDoctor] };
      }

      if (sqlLower.includes('update doctors')) {
        const [name, specialty, experience_years, bio, availability, id] = params;
        const doctor = inMemoryDb.doctors.find(d => d.id === Number(id));
        if (doctor) {
          doctor.name = name;
          doctor.specialty = specialty;
          doctor.experience_years = Number(experience_years);
          doctor.bio = bio;
          doctor.availability = availability;
          const duration = Date.now() - startTime;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Updated doctor #${id} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [doctor] };
        }
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Doctor #${id} not found for update in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      if (sqlLower.includes('delete from doctors')) {
        const id = Number(params[0]);
        const index = inMemoryDb.doctors.findIndex(d => d.id === id);
        const duration = Date.now() - startTime;
        if (index !== -1) {
          const [deleted] = inMemoryDb.doctors.splice(index, 1);
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Deleted doctor #${id} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [deleted] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Doctor #${id} not found for deletion in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      // 1. Appointments Insert
      if (sqlLower.includes('insert into appointments')) {
        const [patient_name, patient_phone, service_name, appointment_date, time_slot] = params;
        const newAppt = {
          id: Math.floor(100 + Math.random() * 900),
          patient_name,
          patient_phone,
          service_name,
          appointment_date,
          time_slot,
          status: 'Pending',
          created_at: new Date(),
        };
        inMemoryDb.appointments.push(newAppt);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Inserted appointment #${newAppt.id} in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [newAppt] };
      }

      // 2. Appointments Update Status
      if (sqlLower.includes('update appointments') && sqlLower.includes('set status = $1')) {
        const [status, id] = params;
        const appt = inMemoryDb.appointments.find(a => a.id === Number(id));
        if (appt) {
          appt.status = status;
          const duration = Date.now() - startTime;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Updated appointment #${id} status to '${status}' in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [appt] };
        }
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Appointment #${id} not found in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      // 3. Appointments Select
      if (sqlLower.includes('from appointments')) {
        const duration = Date.now() - startTime;
        if (sqlLower.includes('where a.patient_phone = $1') || sqlLower.includes('where patient_phone = $1')) {
          const appts = inMemoryDb.appointments.filter(a => a.patient_phone === params[0]);
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Selected ${appts.length} appointments for phone ${params[0]} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: appts };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Selected ${inMemoryDb.appointments.length} total appointments in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [...inMemoryDb.appointments].reverse() };
      }

      // 4. Patients Insert & Upsert
      if (sqlLower.includes('insert into patients')) {
        const [name, phone, email] = params;
        const existing = inMemoryDb.patients.find(p => p.phone === phone);
        if (existing) {
          existing.name = name;
          if (email) existing.email = email;
          const duration = Date.now() - startTime;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Upserted patient phone ${phone} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [existing] };
        }
        const newPatient = {
          id: inMemoryDb.patients.length + 1,
          name,
          phone,
          email,
          medical_history: '',
          created_at: new Date()
        };
        inMemoryDb.patients.push(newPatient);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Created new patient #${newPatient.id} in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [newPatient] };
      }

      // 5. Patients Update
      if (sqlLower.includes('update patients')) {
        const [name, phone, email, medical_history, id] = params;
        const patient = inMemoryDb.patients.find(p => p.id === Number(id));
        if (patient) {
          patient.name = name;
          patient.phone = phone;
          patient.email = email;
          patient.medical_history = medical_history;
          const duration = Date.now() - startTime;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Updated patient #${id} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [patient] };
        }
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Patient #${id} not found for update in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      // 6. Patients Select
      if (sqlLower.includes('from patients')) {
        const duration = Date.now() - startTime;
        if (sqlLower.includes('where id = $1')) {
          const patient = inMemoryDb.patients.find(p => p.id === Number(params[0]));
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Patient #${params[0]} query finished in ${duration}ms (${patient ? 'Found' : 'Not Found'})`);
          console.log('--------------------------------------------------');
          return { rows: patient ? [patient] : [] };
        }
        if (sqlLower.includes('where phone = $1')) {
          const patient = inMemoryDb.patients.find(p => p.phone === params[0]);
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Patient phone ${params[0]} query finished in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: patient ? [patient] : [] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Fetched ${inMemoryDb.patients.length} patients in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [...inMemoryDb.patients].reverse() };
      }

      // 7. Services Select, Insert, Update, Delete
      if (sqlLower.includes('from services')) {
        const duration = Date.now() - startTime;
        if (sqlLower.includes('where id = $1')) {
          const service = inMemoryDb.services.find(s => s.id === Number(params[0]));
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Service #${params[0]} query finished in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: service ? [service] : [] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Fetched ${inMemoryDb.services.length} services in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: inMemoryDb.services };
      }

      if (sqlLower.includes('insert into services')) {
        const [name, description, price, duration_minutes] = params;
        const newService = {
          id: inMemoryDb.services.length + 1,
          name,
          description,
          price: Number(price),
          duration_minutes: Number(duration_minutes),
          created_at: new Date()
        };
        inMemoryDb.services.push(newService);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Inserted service #${newService.id} in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [newService] };
      }

      if (sqlLower.includes('update services')) {
        const [name, description, price, duration_minutes, id] = params;
        const service = inMemoryDb.services.find(s => s.id === Number(id));
        if (service) {
          service.name = name;
          service.description = description;
          service.price = Number(price);
          service.duration_minutes = Number(duration_minutes);
          const duration = Date.now() - startTime;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Updated service #${id} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [service] };
        }
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Service #${id} not found for update in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      if (sqlLower.includes('delete from services')) {
        const id = Number(params[0]);
        const index = inMemoryDb.services.findIndex(s => s.id === id);
        const duration = Date.now() - startTime;
        if (index !== -1) {
          const [deleted] = inMemoryDb.services.splice(index, 1);
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Deleted service #${id} in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [deleted] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Service #${id} not found for deletion in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      // 8. Inquiries Insert, Select, Update
      if (sqlLower.includes('insert into inquiries')) {
        const [name, phone, email, message] = params;
        const newInquiry = {
          id: inMemoryDb.inquiries.length + 1,
          name,
          phone,
          email,
          message,
          status: 'Unread',
          created_at: new Date()
        };
        inMemoryDb.inquiries.push(newInquiry);
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Inserted inquiry #${newInquiry.id} in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [newInquiry] };
      }

      if (sqlLower.includes('from inquiries')) {
        const duration = Date.now() - startTime;
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Fetched ${inMemoryDb.inquiries.length} inquiries in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [...inMemoryDb.inquiries].reverse() };
      }

      if (sqlLower.includes('update inquiries')) {
        const [status, id] = params;
        const inquiry = inMemoryDb.inquiries.find(i => i.id === Number(id));
        const duration = Date.now() - startTime;
        if (inquiry) {
          inquiry.status = status;
          console.log(`⏱️ [DB LAYER - IN-MEMORY] Updated inquiry #${id} status to '${status}' in ${duration}ms`);
          console.log('--------------------------------------------------');
          return { rows: [inquiry] };
        }
        console.log(`⏱️ [DB LAYER - IN-MEMORY] Inquiry #${id} not found for update in ${duration}ms`);
        console.log('--------------------------------------------------');
        return { rows: [] };
      }

      const duration = Date.now() - startTime;
      console.log(`ℹ️ [DB LAYER - IN-MEMORY] Fallback query processed in ${duration}ms, returning empty rows`);
      console.log('--------------------------------------------------');
      return { rows: [] };
    } catch (err) {
      console.error('🔥 [CRITICAL DATABASE ERROR] Fatal Exception in SQL Processor:');
      console.error('🛑 Error Message:', err.message);
      console.error('📍 Full Database Error Stack Trace:\n', err.stack);
      console.log('--------------------------------------------------');
      throw err;
    }
  },
  get pool() {
    return pool;
  },
  get isPostgresAvailable() {
    return isPostgresAvailable;
  }
};

