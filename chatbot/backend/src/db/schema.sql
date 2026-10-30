-- Extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Inmuebles
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('venta', 'arriendo')),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('casa', 'apartamento')),
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Ibagué',
    barrio VARCHAR(100) NOT NULL,
    direccion_aproximada VARCHAR(200),
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    precio NUMERIC(15, 2) NOT NULL,
    area_m2 NUMERIC(8, 2) NOT NULL,
    habitaciones INT NOT NULL DEFAULT 0,
    banos INT NOT NULL DEFAULT 0,
    parqueaderos INT NOT NULL DEFAULT 0,
    estrato INT NOT NULL DEFAULT 3 CHECK (estrato BETWEEN 1 AND 6),
    amenidades TEXT[] NOT NULL DEFAULT '{}',
    disponible BOOLEAN NOT NULL DEFAULT true,
    url_ficha TEXT,
    embedding vector(1536)
);

-- Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Mensajes
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(100) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Tabla de Estado Acumulado de la Conversación
CREATE TABLE IF NOT EXISTS conversation_state (
    conversation_id VARCHAR(100) PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    criterios JSONB NOT NULL DEFAULT '{}'::jsonb,
    ultimo_listado_ids TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para acelerar búsquedas
CREATE INDEX IF NOT EXISTS idx_properties_disponible ON properties(disponible);
CREATE INDEX IF NOT EXISTS idx_properties_operacion ON properties(operacion);
CREATE INDEX IF NOT EXISTS idx_properties_tipo ON properties(tipo);
CREATE INDEX IF NOT EXISTS idx_properties_barrio ON properties(barrio);
CREATE INDEX IF NOT EXISTS idx_properties_precio ON properties(precio);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Índice HNSW para similitud de coseno en embeddings (cuando embedding no es nulo)
CREATE INDEX IF NOT EXISTS idx_properties_embedding ON properties USING hnsw (embedding vector_cosine_ops);
