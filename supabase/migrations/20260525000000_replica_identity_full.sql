-- Realtime DELETE events için gerekli: silinmiş satırın RLS kontrolü yapılabilsin
ALTER TABLE appointments REPLICA IDENTITY FULL;
ALTER TABLE blocks REPLICA IDENTITY FULL;
