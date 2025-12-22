"""
Management command para criar dados de exemplo
Execute com: python manage.py create_sample_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from videos.models import Video, RhythmGrid, Fragment


class Command(BaseCommand):
    help = 'Cria dados de exemplo para testes'

    def handle(self, *args, **options):
        # Pega o usuário admin
        try:
            admin = User.objects.get(username='admin')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('Usuário admin não encontrado. Crie-o primeiro.'))
            return
        
        # Limpa dados existentes
        self.stdout.write('Limpando dados existentes...')
        Fragment.objects.all().delete()
        RhythmGrid.objects.all().delete()
        Video.objects.all().delete()
        
        # Cria vídeos de exemplo
        self.stdout.write('Criando vídeos de exemplo...')
        
        videos_data = [
            {
                'title': 'Aula de Violão - Escala Pentatônica',
                'description': 'Aprenda a escala pentatônica menor em todas as posições do braço do violão.',
                'duration': 180.5,
                'fps': 30.0,
                'width': 1920,
                'height': 1080,
            },
            {
                'title': 'Técnica de Dedilhado - Fingerstyle',
                'description': 'Exercícios progressivos de fingerstyle para desenvolver independência dos dedos.',
                'duration': 240.0,
                'fps': 30.0,
                'width': 1920,
                'height': 1080,
            },
            {
                'title': 'Ritmo Samba - Padrão Básico',
                'description': 'Aprenda o padrão rítmico básico do samba no violão.',
                'duration': 150.0,
                'fps': 30.0,
                'width': 1920,
                'height': 1080,
            },
            {
                'title': 'Bossa Nova - Batida Clássica',
                'description': 'Domine a batida clássica da bossa nova com exercícios práticos.',
                'duration': 200.0,
                'fps': 30.0,
                'width': 1920,
                'height': 1080,
            },
        ]
        
        videos = []
        for video_data in videos_data:
            video = Video.objects.create(
                owner=admin,
                title=video_data['title'],
                description=video_data['description'],
                duration=video_data['duration'],
                fps=video_data['fps'],
                width=video_data['width'],
                height=video_data['height'],
                is_processed=True,
            )
            videos.append(video)
            self.stdout.write(self.style.SUCCESS(f'  ✓ Criado: {video.title}'))
        
        # Cria rhythm grids
        self.stdout.write('\nCriando rhythm grids...')
        
        rhythm_configs = [
            {'bpm': 120, 'time_sig': (4, 4), 'offset': 0.5},
            {'bpm': 90, 'time_sig': (4, 4), 'offset': 1.0},
            {'bpm': 140, 'time_sig': (2, 4), 'offset': 0.3},
            {'bpm': 110, 'time_sig': (4, 4), 'offset': 0.8},
        ]
        
        for video, config in zip(videos, rhythm_configs):
            rhythm_grid = RhythmGrid.objects.create(
                video=video,
                bpm=config['bpm'],
                time_signature_numerator=config['time_sig'][0],
                time_signature_denominator=config['time_sig'][1],
                offset_start=config['offset'],
            )
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ Grid: '{video.title}' - {config['bpm']} BPM, {config['time_sig'][0]}/{config['time_sig'][1]}"
            ))
        
        # Cria fragmentos
        self.stdout.write('\nCriando fragmentos...')
        
        fragments_video1 = [
            {
                'name': 'Introdução',
                'description': 'Apresentação da escala e conceitos básicos',
                'bar_start': 0,
                'bar_end': 7,
                'tags': ['introdução', 'teoria'],
                'color': '#3B82F6',
            },
            {
                'name': 'Primeira Posição',
                'description': 'Escala pentatônica na primeira posição',
                'bar_start': 8,
                'bar_end': 23,
                'tags': ['prática', 'posição-1'],
                'color': '#10B981',
            },
            {
                'name': 'Segunda Posição',
                'description': 'Escala pentatônica na segunda posição',
                'bar_start': 24,
                'bar_end': 39,
                'tags': ['prática', 'posição-2'],
                'color': '#F59E0B',
            },
        ]
        
        for frag_data in fragments_video1:
            fragment = Fragment.objects.create(
                video=videos[0],
                name=frag_data['name'],
                description=frag_data['description'],
                bar_start=frag_data['bar_start'],
                bar_end=frag_data['bar_end'],
                tags=frag_data['tags'],
                color=frag_data['color'],
            )
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ {fragment.name} (compassos {fragment.bar_start}-{fragment.bar_end})"
            ))
        
        fragments_video2 = [
            {
                'name': 'Aquecimento',
                'description': 'Exercícios de aquecimento para os dedos',
                'bar_start': 0,
                'bar_end': 15,
                'tags': ['aquecimento', 'técnica'],
                'color': '#8B5CF6',
            },
            {
                'name': 'Padrão Arpejo 1',
                'description': 'Primeiro padrão de arpejo',
                'bar_start': 16,
                'bar_end': 31,
                'tags': ['arpejo', 'padrão'],
                'color': '#EC4899',
            },
        ]
        
        for frag_data in fragments_video2:
            fragment = Fragment.objects.create(
                video=videos[1],
                name=frag_data['name'],
                description=frag_data['description'],
                bar_start=frag_data['bar_start'],
                bar_end=frag_data['bar_end'],
                tags=frag_data['tags'],
                color=frag_data['color'],
            )
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ {fragment.name} (compassos {fragment.bar_start}-{fragment.bar_end})"
            ))
        
        self.stdout.write(self.style.SUCCESS('\n✅ Dados de exemplo criados com sucesso!'))
        self.stdout.write(f'\nResumo:')
        self.stdout.write(f'  - {Video.objects.count()} vídeos')
        self.stdout.write(f'  - {RhythmGrid.objects.count()} rhythm grids')
        self.stdout.write(f'  - {Fragment.objects.count()} fragmentos')
