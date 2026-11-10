-- PostgreSQL Database Schema for PureDentist Clinic

-- 1. Patients Table (CRM)
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    medical_history TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration safety for existing installations
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;

-- 2. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Services & Pricing Table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Contact Form Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Unread',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Doctors & Specialists Table
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255) NOT NULL,
    experience_years INT DEFAULT 0,
    bio TEXT,
    availability VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(patient_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_doctors_name ON doctors(name);

-- Seed Initial Dental Services Catalog (10 Core Treatments)
INSERT INTO services (id, name, description, price, duration_minutes) VALUES
(1, 'Teeth Cleaning & Scaling', 'Professional Plaque & Tartar Removal', 95.00, 45),
(2, 'Tooth Fillings (Cavity Treatment)', 'Composite & Natural Resin Restoration', 120.00, 60),
(3, 'Root Canal Treatment (RCT)', 'Microscopic Nerve & Pulp Healing', 350.00, 90),
(4, 'Teeth Whitening (Bleaching)', 'Cold-Light Laser Enamel Brightening', 280.00, 45),
(5, 'Gum Treatment (Periodontal Care)', 'Gingivitis, Bleeding & Laser Periodontal Therapy', 150.00, 50),
(6, 'Dentures (Artificial Teeth Set)', 'Complete & Partial Flexible Acrylic Plates', 450.00, 60),
(7, 'Invisible Clear Aligners', '3D Orthodontic Trays & Custom Aligners', 1200.00, 30),
(8, 'Dental Crowns & Bridges', 'Zirconia & Ceramic Cap Restorations', 300.00, 60),
(9, 'Wisdom Tooth Extraction', 'Gentle & Surgical Wisdom Tooth Removal', 200.00, 45),
(10, 'Pediatric Dental Care', 'Gentle Child Dentistry & Preventive Fluoride Shield', 80.00, 30)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Doctors
INSERT INTO doctors (id, name, specialty, experience_years, bio, availability) VALUES
(1, 'Dr. Ahmed Khan', 'Prosthodontist', 12, 'Specialist in dental implants and aesthetic porcelain restorations.', 'Mon - Fri'),
(2, 'Dr. Sarah Ahmed', 'Orthodontist', 8, 'Expert in invisible aligners and pediatric orthodontics.', 'Mon, Wed, Fri'),
(3, 'Dr. Usman Ali', 'Endodontist', 10, 'Root canal specialist using microscopic laser technology.', 'Tue, Thu, Sat'),
(4, 'Dr. Maria Zain', 'Oral Surgeon', 15, 'Expert in wisdom tooth extractions and complex dental surgeries.', 'Mon - Thu'),
(5, 'Dr. Hassan Raza', 'General Dentist', 7, 'Passionate about preventive care and painless dentistry.', 'Daily')
ON CONFLICT (id) DO NOTHING;
