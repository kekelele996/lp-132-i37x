-- 社区老人关怀服务平台数据库初始化脚本

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('child', 'worker', 'volunteer', 'admin')),
    avatar VARCHAR(255),
    gender VARCHAR(10),
    age INTEGER,
    address TEXT,
    skills TEXT,
    introduction TEXT,
    rating DECIMAL(3, 2) DEFAULT 5.0,
    order_count INTEGER DEFAULT 0,
    total_income DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 老人档案表
CREATE TABLE IF NOT EXISTS elderly_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    age INTEGER NOT NULL,
    phone VARCHAR(20),
    id_card VARCHAR(20),
    medical_history TEXT,
    medication TEXT,
    allergy_history TEXT,
    address TEXT NOT NULL,
    emergency_contact VARCHAR(50),
    emergency_phone VARCHAR(20),
    avatar VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 照护需求表
CREATE TABLE IF NOT EXISTS care_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    elderly_id UUID NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    care_type VARCHAR(50) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    address TEXT NOT NULL,
    duration_hours DECIMAL(4, 2),
    price DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    worker_id UUID REFERENCES users(id),
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES care_needs(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 收藏护工表
CREATE TABLE IF NOT EXISTS favorite_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(child_id, worker_id)
);

-- 护工排班表
CREATE TABLE IF NOT EXISTS worker_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'evening', 'full')),
    is_available BOOLEAN DEFAULT TRUE,
    order_id UUID REFERENCES care_needs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, date, shift_type)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_elderly_child ON elderly_profiles(child_id);
CREATE INDEX IF NOT EXISTS idx_care_needs_status ON care_needs(status);
CREATE INDEX IF NOT EXISTS idx_care_needs_child ON care_needs(child_id);
CREATE INDEX IF NOT EXISTS idx_care_needs_worker ON care_needs(worker_id);
CREATE INDEX IF NOT EXISTS idx_care_needs_time ON care_needs(start_time);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_schedules_worker ON worker_schedules(worker_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON worker_schedules(date);

-- 插入测试数据 (密码统一为: 123456)
INSERT INTO users (username, password, real_name, phone, role, age, address, skills, introduction) VALUES
('child1', '$2a$10$aKYK4fhQExRlfuk45F/P0uPaKbwztgyx32Fyw4VA9z91bGR56eUhq', '张小明', '13800138001', 'child', 35, '北京市朝阳区', '', '孝顺的儿子'),
('worker1', '$2a$10$aKYK4fhQExRlfuk45F/P0uPaKbwztgyx32Fyw4VA9z91bGR56eUhq', '李护工', '13800138002', 'worker', 40, '北京市海淀区', '血压测量、打针、输液', '有10年护理经验'),
('worker2', '$2a$10$aKYK4fhQExRlfuk45F/P0uPaKbwztgyx32Fyw4VA9z91bGR56eUhq', '王护士', '13800138003', 'worker', 35, '北京市朝阳区', '康复训练、日常照料', '专业康复护士'),
('volunteer1', '$2a$10$aKYK4fhQExRlfuk45F/P0uPaKbwztgyx32Fyw4VA9z91bGR56eUhq', '赵志愿', '13800138004', 'volunteer', 25, '北京市东城区', '聊天陪伴', '大学生志愿者'),
('admin1', '$2a$10$aKYK4fhQExRlfuk45F/P0uPaKbwztgyx32Fyw4VA9z91bGR56eUhq', '管理员', '13800138000', 'admin', 30, '北京市', '', '系统管理员');

INSERT INTO elderly_profiles (child_id, name, gender, age, phone, medical_history, medication, address, emergency_contact, emergency_phone, notes) VALUES
((SELECT id FROM users WHERE username = 'child1'), '张大爷', '男', 78, '13900139001', '高血压、糖尿病', '降压药、胰岛素', '北京市朝阳区幸福小区3号楼2单元501', '张小明', '13800138001', '喜欢下棋，需要有人陪同散步');

INSERT INTO care_needs (child_id, elderly_id, title, description, care_type, start_time, address, duration_hours, price) VALUES
((SELECT id FROM users WHERE username = 'child1'), (SELECT id FROM elderly_profiles WHERE name = '张大爷'), '上门量血压', '每周三下午上门给老人量血压，记录数据', 'health_check', '2024-01-10 14:00:00', '北京市朝阳区幸福小区3号楼2单元501', 1.0, 80.00),
((SELECT id FROM users WHERE username = 'child1'), (SELECT id FROM elderly_profiles WHERE name = '张大爷'), '陪同就医', '下周一陪同老人去医院复查', 'accompany', '2024-01-15 08:00:00', '北京市朝阳区幸福小区3号楼2单元501', 4.0, 300.00);
